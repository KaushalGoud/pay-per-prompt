import {
  Client,
  AccountId,
  PrivateKey,
  ContractId,
  ContractCallQuery,
  ContractFunctionParameters,
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { createHash, randomUUID } from "node:crypto";
import { getServerConfig } from "@/lib/config";

export interface ResolvedLedger {
  topicId: string;
  source: "onchain" | "env";
}

export interface LedgerAppendResult {
  topicId: string;
  sequenceNumber: number;
  txId: string;
  consensusTimestamp: string | null;
  mirrorUrl: string;
  hashscanUrl: string;
}

export interface LedgerEntry {
  sequenceNumber: number;
  consensusTimestamp: string | null;
  record: Record<string, unknown> | null;
  rawContents: string;
}

export interface PricingGateResult {
  passed: boolean;
  usdMicros: number;
  roundId: number;
  rateUsdMicrosPerHbar: number;
}

const MIRROR_RETRY_ATTEMPTS = 8;
const MIRROR_RETRY_DELAY_MS = 1000;

function buildOperatorClient(config: ReturnType<typeof getServerConfig>): Client {
  if (!config.operatorAccountId || !config.operatorPrivateKey) {
    throw new Error(
      "HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env. " +
        "Run `npm run setup:hedera` after funding the operator account with testnet HBAR.",
    );
  }
  const client = config.network === "testnet" ? Client.forTestnet() : Client.forMainnet();
  client.setOperator(
    AccountId.fromString(config.operatorAccountId),
    PrivateKey.fromStringECDSA(config.operatorPrivateKey),
  );
  return client;
}

function numericPart(entityId: string): number | null {
  const clean = entityId.trim();
  if (/^\d+$/.test(clean)) return Number(clean);
  const parts = clean.split(".");
  if (parts.length === 3) return Number(parts[2]);
  return null;
}

/**
 * Resolves the HCS topic the server is allowed to append to, preferring the
 * on-chain anchor. When both the contract and the topic env are set they MUST
 * agree; a mismatch is treated as a hard failure so the ledger can never be
 * silently repointed.
 */
export async function resolveLedgerTopic(config: ReturnType<typeof getServerConfig>): Promise<ResolvedLedger> {
  if (config.contractId && config.topicId) {
    const client = buildOperatorClient(config);
    try {
      const query = new ContractCallQuery()
        .setContractId(ContractId.fromString(config.contractId))
        .setGas(100_000)
        .setFunction("topicId");
      const result = await query.execute(client);
      const anchored = result.getUint64(0)?.toNumber() ?? null;
      if (anchored === null) {
        throw new Error(`Contract ${config.contractId} returned no topicId.`);
      }
      if (anchored !== numericPart(config.topicId)) {
        throw new Error(
          `On-chain anchor (topic ${anchored}) disagrees with HEDERA_TOPIC_ID (${config.topicId}). ` +
            "Refusing to append to a mismatched ledger.",
        );
      }
      return { topicId: config.topicId, source: "onchain" };
    } finally {
      client.close();
    }
  }

  if (config.contractId) {
    const client = buildOperatorClient(config);
    try {
      const query = new ContractCallQuery()
        .setContractId(ContractId.fromString(config.contractId))
        .setGas(100_000)
        .setFunction("topicId");
      const result = await query.execute(client);
      const anchored = result.getUint64(0)?.toNumber() ?? null;
      if (anchored === null) {
        throw new Error(`Contract ${config.contractId} returned no topicId.`);
      }
      return { topicId: `0.0.${anchored}`, source: "onchain" };
    } finally {
      client.close();
    }
  }

  if (config.topicId) {
    console.warn(
      "HEDERA_CONTRACT_ID is not set — the HCS topic is pinned to the env value only. " +
        "Set HEDERA_CONTRACT_ID to pin it on-chain.",
    );
    return { topicId: config.topicId, source: "env" };
  }

  throw new Error(
    "Ledger is not configured. Set HEDERA_TOPIC_ID (+ HEDERA_CONTRACT_ID) in .env " + "or run `npm run setup:hedera`.",
  );
}

/**
 * Consults the on-chain Chainlink fair-price gate for a payment. Load-bearing:
 * the ask handler runs this BEFORE generating an answer, and any failure
 * (unset contract, healthy-oracle revert, or a value below the on-chain USD
 * floor) is treated by the caller as "cancel — do not settle".
 */
export async function resolvePricingGate(
  config: ReturnType<typeof getServerConfig>,
  amountTinybar: number,
): Promise<PricingGateResult> {
  if (!config.pricingContractId) {
    throw new Error(
      "HEDERA_PRICING_CONTRACT_ID is not set. The Chainlink fair-price gate is load-bearing; " +
        "run `npm run setup:hedera` to deploy ChainlinkPricing.",
    );
  }
  const client = buildOperatorClient(config);
  try {
    const contractId = ContractId.fromString(config.pricingContractId);

    const gate = await new ContractCallQuery()
      .setContractId(contractId)
      .setGas(300_000)
      .setFunction("paymentGate", new ContractFunctionParameters().addUint64(amountTinybar))
      .execute(client);
    const passed = gate.getBool(0) ?? false;
    const usdMicros = gate.getUint256(1)?.toNumber() ?? 0;

    const health = await new ContractCallQuery()
      .setContractId(contractId)
      .setGas(300_000)
      .setFunction("feedHealth")
      .execute(client);
    const roundId = health.getUint256(0)?.toNumber() ?? 0;
    const rateUsdMicrosPerHbar = health.getUint256(2)?.toNumber() ?? 0;

    return { passed, usdMicros, roundId, rateUsdMicrosPerHbar };
  } finally {
    client.close();
  }
}

interface AppendLedgerInput {
  question: string;
  interactionId: string;
  priceUsdMicros?: number;
  priceFeedRateUsdMicrosPerHbar?: number;
}

/**
 * Appends the fulfilment record to the HCS ledger. Load-bearing: the ask
 * handler calls this BEFORE returning the answer, and a failure here means an
 * error response (which the x402 layer treats as "cancel — do not settle").
 */
export async function appendLedgerRecord(input: AppendLedgerInput): Promise<LedgerAppendResult> {
  const config = getServerConfig();
  const client = buildOperatorClient(config);

  try {
    const resolved = await resolveLedgerTopic(config);
    const promptHash = createHash("sha256").update(input.question).digest("hex");
    const record = {
      v: 2,
      type: "pay-per-prompt/fulfilment",
      interactionId: input.interactionId,
      promptHash,
      amountTinybar: config.priceTinybar,
      recipient: config.receiverAccountId,
      model: config.aiModel,
      ...(input.priceUsdMicros !== undefined
        ? {
            priceSource: "chainlink" as const,
            priceUsdMicros: input.priceUsdMicros,
            priceFeedRateUsdMicrosPerHbar: input.priceFeedRateUsdMicrosPerHbar,
          }
        : {}),
      status: "delivered",
      at: new Date().toISOString(),
    };

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(resolved.topicId))
      .setMessage(JSON.stringify(record));

    const response = await tx.execute(client);
    const txRecord = await response.getRecord(client);
    const sequenceNumber = Number(txRecord.receipt.topicSequenceNumber ?? 0n);
    const consensusMs = txRecord.consensusTimestamp
      ? txRecord.consensusTimestamp.seconds.toNumber() * 1000 + txRecord.consensusTimestamp.nanos.toNumber() / 1_000_000
      : null;

    const txId = response.transactionId.toString();
    const mirrorUrl = `${config.mirrorNodeUrl}/topics/${resolved.topicId}/messages/${sequenceNumber}`;
    const hashscanUrl = `https://hashscan.io/${config.network}/topic/${resolved.topicId}/message/${sequenceNumber}`;

    await confirmOnMirror(config, resolved.topicId, sequenceNumber);

    return {
      topicId: resolved.topicId,
      sequenceNumber,
      txId,
      consensusTimestamp: consensusMs !== null ? String(consensusMs) : null,
      mirrorUrl,
      hashscanUrl,
    };
  } finally {
    client.close();
  }
}

async function confirmOnMirror(
  config: ReturnType<typeof getServerConfig>,
  topicId: string,
  sequenceNumber: number,
): Promise<void> {
  const url = `${config.mirrorNodeUrl}/topics/${topicId}/messages/${sequenceNumber}`;
  for (let attempt = 0; attempt < MIRROR_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      if (res.status === 404 && attempt < MIRROR_RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, MIRROR_RETRY_DELAY_MS));
        continue;
      }
      break;
    } catch {
      if (attempt < MIRROR_RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, MIRROR_RETRY_DELAY_MS));
        continue;
      }
      break;
    }
  }
  console.warn(
    "Consensus confirmed the message but the mirror node has not yet indexed it. " +
      `Retry link: ${config.mirrorNodeUrl}/topics/${topicId}/messages/${sequenceNumber}`,
  );
}

/** Fetches the most recent decoded entries from the public ledger. */
export async function listRecentLedgerEntries(
  config: ReturnType<typeof getServerConfig>,
  limit = 20,
): Promise<LedgerEntry[]> {
  if (!config.topicId) return [];
  const url = `${config.mirrorNodeUrl}/topics/${config.topicId}/messages?limit=${limit}&order=desc`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: Array<Record<string, unknown>> };
  return (
    (data.messages as Array<{ sequence_number: number; consensus_timestamp?: string; message?: string }>) ?? []
  ).map((msg) => {
    let record: Record<string, unknown> | null = null;
    const rawContents = msg.message ?? "";
    try {
      const decoded = Buffer.from(rawContents, "base64").toString("utf-8");
      record = JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      record = null;
    }
    return {
      sequenceNumber: Number(msg.sequence_number),
      consensusTimestamp: msg.consensus_timestamp ?? null,
      record,
      rawContents,
    };
  });
}

/** Fallback id for caller-initiated requests that never reach the handler. */
export function newInteractionId(): string {
  return randomUUID();
}
