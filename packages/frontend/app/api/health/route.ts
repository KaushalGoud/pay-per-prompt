import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config";
import { resolveLedgerTopic } from "@/lib/hedera-ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfig();

  const checks = {
    receiverAccount: Boolean(config.receiverAccountId),
    price: config.priceTinybar > 0,
    feePayer: Boolean(config.feePayerAccountId),
    operator: Boolean(config.operatorAccountId && config.operatorPrivateKey),
    aiProvider: Boolean(config.aiApiKey),
    topic: Boolean(config.topicId),
    onchainAnchor: Boolean(config.contractId),
  };

  let ledger: { ok: boolean; source?: string; topicId?: string; error?: string };
  if (config.topicId || config.contractId) {
    try {
      const resolved = await resolveLedgerTopic(config);
      ledger = { ok: true, source: resolved.source, topicId: resolved.topicId };
    } catch (err) {
      ledger = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    ledger = {
      ok: false,
      error: "HEDERA_TOPIC_ID (or HEDERA_CONTRACT_ID) is unset. Run `npm run setup:hedera`.",
    };
  }

  const ok = Object.values(checks).every(Boolean) && ledger.ok;

  return NextResponse.json(
    {
      ok,
      network: config.network,
      checks,
      ledger,
    },
    { status: ok ? 200 : 503 },
  );
}
