import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config";
import { resolveLedgerTopic, resolvePricingGate } from "@/lib/hedera-ledger";

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
    chainlinkGate: Boolean(config.pricingContractId),
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

  let pricing: {
    ok: boolean;
    error?: string;
    passed?: boolean;
    usdMicros?: number;
    rateUsdMicrosPerHbar?: number;
  };
  if (config.pricingContractId) {
    try {
      const gate = await resolvePricingGate(config, config.priceTinybar);
      pricing = {
        ok: true,
        passed: gate.passed,
        usdMicros: gate.usdMicros,
        rateUsdMicrosPerHbar: gate.rateUsdMicrosPerHbar,
      };
    } catch (err) {
      pricing = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    pricing = {
      ok: false,
      error: "HEDERA_PRICING_CONTRACT_ID is unset. Run `npm run setup:hedera`.",
    };
  }

  const ok = Object.values(checks).every(Boolean) && ledger.ok && pricing.ok;

  return NextResponse.json(
    {
      ok,
      network: config.network,
      checks,
      ledger,
      pricing,
    },
    { status: ok ? 200 : 503 },
  );
}
