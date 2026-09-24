import { NextResponse } from "next/server";
import { getServerConfig } from "@/lib/config";
import { listRecentLedgerEntries } from "@/lib/hedera-ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfig();
  const entries = await listRecentLedgerEntries(config);
  return NextResponse.json({
    ok: Boolean(config.topicId),
    topicId: config.topicId,
    mirrorNode: config.mirrorNodeUrl,
    count: entries.length,
    entries,
  });
}
