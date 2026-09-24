import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { getServerConfig } from "@/lib/config";

const config = getServerConfig();

const facilitatorClient = new HTTPFacilitatorClient({
  url: config.facilitatorUrl,
});

export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "hedera:testnet",
  new ExactHederaScheme({
    defaultAssets: {
      "hedera:testnet": { asset: "0.0.0", decimals: 8 },
    },
  }),
);
