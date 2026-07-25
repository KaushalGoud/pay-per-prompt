"use client";

import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@x402/hedera";

const signer = createClientHederaSigner(
  process.env.NEXT_PUBLIC_HEDERA_CLIENT_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(
    process.env.NEXT_PUBLIC_HEDERA_CLIENT_PRIVATE_KEY!.replace(/^0x/i, ""),
  ),
  { network: "hedera:testnet" },
);

const x402ClientInstance = new x402Client().register(
  "hedera:*",
  new ExactHederaScheme(signer),
);

export const fetchWithPayment = wrapFetchWithPayment(fetch, x402ClientInstance);
