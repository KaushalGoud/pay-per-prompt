import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { resourceServer } from "@/lib/x402-server";

const providerApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
const providerBaseUrl =
  process.env.OPENAI_BASE_URL ||
  process.env.AI_BASE_URL ||
  "https://api.openai.com/v1";
const providerModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RECEIVER_ACCOUNT_ID = process.env.RECEIVER_ACCOUNT_ID!;

const handler = async (
  request: NextRequest,
): Promise<NextResponse<{ error: string } | { answer: string }>> => {
  const body = await request.json();
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 },
    );
  }
  if (!providerApiKey) {
    return NextResponse.json(
      { error: "AI provider is not configured." },
      { status: 500 },
    );
  }

  const aiRes = await fetch(
    `${providerBaseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: providerModel,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that answers user questions clearly and concisely.",
          },
          { role: "user", content: question },
        ],
      }),
    },
  );

  if (!aiRes.ok) {
    return NextResponse.json(
      { error: "Unable to generate a response from the AI provider." },
      { status: aiRes.status },
    );
  }

  const data = await aiRes.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    return NextResponse.json(
      { error: "The AI provider returned an empty response." },
      { status: 502 },
    );
  }

  return NextResponse.json({ answer });
};

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      network: "hedera:testnet",
      payTo: RECEIVER_ACCOUNT_ID,
      price: {
        asset: "0.0.0",
        amount: String(
          Math.round(parseFloat(process.env.PRICE_HBAR || "0.1") * 1e8),
        ),
      },
      maxTimeoutSeconds: 60,
      extra: {
        feePayer: process.env.BLOCKY402_FEE_PAYER!,
      },
    },
    description: "Per-question AI answer access",
  },
  resourceServer,
);