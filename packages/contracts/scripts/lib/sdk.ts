import { AccountId, Client, PrivateKey, PublicKey } from "@hashgraph/sdk";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

// Hardhat runs scripts with cwd = packages/contracts, but the single source of
// truth is the repo-root .env (mirrors the scaffold-hbar layout).
loadDotenv({ path: path.resolve(__dirname, "../../../../.env") });

export type HederaNetwork = "testnet" | "mainnet";

export function getNetwork(): HederaNetwork {
  const net = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  if (net !== "testnet" && net !== "mainnet") {
    throw new Error(`HEDERA_NETWORK must be "testnet" or "mainnet", got "${net}".`);
  }
  return net;
}

export function getMirrorNodeUrl(net: HederaNetwork): string {
  const explicit = process.env.HEDERA_MIRROR_NODE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return net === "testnet"
    ? "https://testnet.mirrornode.hedera.com/api/v1"
    : "https://mainnet-public.mirrornode.hedera.com/api/v1";
}

function parseOperatorKey(rawKey: string): PrivateKey {
  return PrivateKey.fromStringECDSA(rawKey.replace(/^0x/i, ""));
}

export interface OperatorClient {
  client: Client;
  network: HederaNetwork;
  mirrorUrl: string;
  operatorId: string;
  operatorPublicKey: PublicKey;
}

export function operatorClient(): OperatorClient {
  const network = getNetwork();
  const client = network === "testnet" ? Client.forTestnet() : Client.forMainnet();

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    throw new Error(
      "HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env (operator account). " +
        "Fund the operator with testnet HBAR from https://portal.hedera.com/faucet.",
    );
  }

  const operatorKey = parseOperatorKey(privateKey);
  client.setOperator(AccountId.fromString(accountId), operatorKey);

  return {
    client,
    network,
    mirrorUrl: getMirrorNodeUrl(network),
    operatorId: accountId,
    operatorPublicKey: operatorKey.publicKey,
  };
}

export function extractNumericId(entityId: string): number {
  const clean = entityId.trim();
  if (/^\d+$/.test(clean)) return Number(clean);
  const parts = clean.split(".");
  if (parts.length === 3) return Number(parts[2]);
  throw new Error(`Cannot parse Hedera entity id from "${entityId}". Expected "0.0.x".`);
}

export function toMirrorTxId(txId: string): string {
  if (!txId.includes("@")) return txId;
  const [account, timePart] = txId.split("@");
  const [seconds, nanos] = timePart.split(".");
  return `${account}-${seconds}-${nanos}`;
}

export function hashscanTxUrl(network: HederaNetwork, txId: string): string {
  return `https://hashscan.io/${network}/transaction/${toMirrorTxId(txId)}`;
}

export function networkShortName(network: HederaNetwork): string {
  return `payperprompt:${network}`;
}
