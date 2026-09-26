/**
 * Server-side configuration with explicit validation.
 *
 * Unlike the rest of the app this module is `import ... from "server-only"`-free
 * on purpose (the package is single-purpose), but it is only imported from
 * server modules. Every accessor returns `null` when a required value is
 * missing so route handlers can fail with a clear message instead of crashing
 * on an undefined dereference.
 */

export interface ServerConfig {
  network: "testnet" | "mainnet";
  receiverAccountId: string;
  priceTinybar: number;
  facilitatorUrl: string;
  feePayerAccountId: string | null;
  topicId: string | null;
  contractId: string | null;
  pricingContractId: string | null;
  chainlinkPriceFeedAddress: string | null;
  operatorAccountId: string | null;
  operatorPrivateKey: string | null;
  aiApiKey: string | null;
  aiBaseUrl: string;
  aiModel: string;
  mirrorNodeUrl: string;
}

function normalizeNetwork(raw: string | undefined): "testnet" | "mainnet" {
  return raw?.toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

function tinybarFromHbar(hbar: string | undefined): number {
  const parsed = parseFloat(hbar ?? "0.1");
  return Math.round((isNaN(parsed) ? 0.1 : parsed) * 1e8);
}

export function getServerConfig(): ServerConfig {
  const network = normalizeNetwork(process.env.HEDERA_NETWORK);
  const mirrorNodeUrl = (
    process.env.HEDERA_MIRROR_NODE_URL ??
    (network === "testnet"
      ? "https://testnet.mirrornode.hedera.com/api/v1"
      : "https://mainnet-public.mirrornode.hedera.com/api/v1")
  ).replace(/\/$/, "");

  return {
    network,
    receiverAccountId: process.env.RECEIVER_ACCOUNT_ID ?? "",
    priceTinybar: tinybarFromHbar(process.env.PRICE_HBAR),
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://api.testnet.blocky402.com",
    feePayerAccountId: process.env.BLOCKY402_FEE_PAYER?.trim() || null,
    topicId: process.env.HEDERA_TOPIC_ID?.trim() || null,
    contractId: process.env.HEDERA_CONTRACT_ID?.trim() || null,
    pricingContractId: process.env.HEDERA_PRICING_CONTRACT_ID?.trim() || null,
    chainlinkPriceFeedAddress: process.env.CHAINLINK_PRICE_FEED?.trim() || null,
    operatorAccountId: process.env.HEDERA_ACCOUNT_ID?.trim() || null,
    operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY?.replace(/^0x/i, "") || null,
    aiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    aiBaseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    aiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    mirrorNodeUrl,
  };
}

export function hashscanUrl(network: "testnet" | "mainnet", txId: string): string {
  const mirrorTx = txId.includes("@")
    ? (() => {
        const [account, timePart] = txId.split("@");
        const [seconds, nanos] = timePart.split(".");
        return `${account}-${seconds}-${nanos}`;
      })()
    : txId;
  return `https://hashscan.io/${network}/transaction/${mirrorTx}`;
}
