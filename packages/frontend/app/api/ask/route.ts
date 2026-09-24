import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { resourceServer } from "@/lib/x402-server";
import { generateAnswer } from "@/lib/ai";
import { appendLedgerRecord, newInteractionId } from "@/lib/hedera-ledger";
import { getServerConfig } from "@/lib/config";

export interface AskResponse {
  answer: string;
  ledger?: {
    topicId: string;
    sequenceNumber: number;
    txId: string;
    mirrorUrl: string;
    hashscanUrl: string;
  };
}

const handler = async (request: NextRequest): Promise<NextResponse<{ error: string } | AskResponse>> => {
  const config = getServerConfig();

  if (!config.receiverAccountId) {
    return NextResponse.json({ error: "RECEIVER_ACCOUNT_ID is not configured." }, { status: 500 });
  }

  let body: { question?: string };
  try {
    body = (await request.json()) as { question?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const interactionId = newInteractionId();

  const answer = await generateAnswer(question);

  try {
    const ledger = await appendLedgerRecord({ question, interactionId });
    return NextResponse.json({ answer, ledger });
  } catch (err) {
    console.error("HCS ledger append failed — refusing to settle:", err);
    return NextResponse.json(
      {
        error:
          "The answer was generated but could not be written to the HCS audit ledger, " +
          "so the payment was cancelled.",
      },
      { status: 502 },
    );
  }
};

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      network: "hedera:testnet",
      // payTo and price resolve per request so values always come from the
      // live environment, even when the module is first evaluated at build time.
      payTo: () => {
        const cfg = getServerConfig();
        if (!cfg.receiverAccountId) {
          throw new Error("RECEIVER_ACCOUNT_ID is not configured. Copy .env.example to .env and fill it in.");
        }
        return cfg.receiverAccountId;
      },
      price: () => {
        const cfg = getServerConfig();
        return {
          asset: "0.0.0",
          amount: String(cfg.priceTinybar),
        };
      },
      maxTimeoutSeconds: 60,
      extra: getServerConfig().feePayerAccountId ? { feePayer: getServerConfig().feePayerAccountId } : undefined,
    },
    description: "Per-question AI answer access",
  },
  resourceServer,
);
