"use client";

import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@x402/hedera";

let sharedFetchWithPayment: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null = null;

function buildClient() {
  const accountId = process.env.NEXT_PUBLIC_HEDERA_CLIENT_ACCOUNT_ID;
  const privateKey = process.env.NEXT_PUBLIC_HEDERA_CLIENT_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    throw new Error(
      "NEXT_PUBLIC_HEDERA_CLIENT_ACCOUNT_ID and NEXT_PUBLIC_HEDERA_CLIENT_PRIVATE_KEY are not set. " +
        "Add a funded payer account to your .env and restart the dev server.",
    );
  }

  const signer = createClientHederaSigner(accountId, PrivateKey.fromStringECDSA(privateKey.replace(/^0x/i, "")), {
    network: "hedera:testnet",
  });

  const scheme = new ExactHederaScheme(signer);

  // Native HBAR (asset 0.0.0) is not in @x402/hedera's default-asset registry
  // (USDC is), so the client's default spendControls would refuse to spend it.
  // Allowlist it explicitly; the per-prompt price is quoted by the server.
  return x402Client.fromConfig({
    schemes: [{ network: "hedera:*", client: scheme }],
    spendControls: {
      allowedAssets: [{ asset: "0.0.0", network: "hedera:testnet" }],
    },
  });
}

/**
 * Lazily-initialised wrapper: the browser never touches the Hedera client
 * until the first payment is actually needed, so misconfiguration surfaces as
 * a readable error at request time instead of a blank page.
 */
export function fetchWithPayment(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!sharedFetchWithPayment) {
    const client = buildClient();
    sharedFetchWithPayment = wrapFetchWithPayment(fetch, client);
  }
  return sharedFetchWithPayment(input, init);
}
