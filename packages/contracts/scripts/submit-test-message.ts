import {
  ContractCallQuery,
  ContractFunctionParameters,
  ContractId,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { operatorClient } from "./lib/sdk";

/**
 * Reads the on-chain Chainlink HBAR/USD value for a sample payment and writes
 * it into a proof-of-record HCS message. If HEDERA_PRICING_CONTRACT_ID is set
 * the pricing contract is queried (fail-closed on any error); otherwise the
 * record is submitted without the price fields.
 */
async function resolvePricingMicros(client: ReturnType<typeof operatorClient>["client"], tinybar: number) {
  const pricingId = process.env.HEDERA_PRICING_CONTRACT_ID?.trim();
  if (!pricingId) return { priceUsdMicros: undefined, priceFeedRateUsdMicrosPerHbar: undefined };

  const query = new ContractCallQuery()
    .setContractId(ContractId.fromString(pricingId))
    .setGas(300_000)
    .setFunction("usdMicrosValue", new ContractFunctionParameters().addUint64(tinybar));
  const result = await query.execute(client);
  const usdMicros = result.getUint256(0)?.toNumber() ?? null;
  if (usdMicros === null) throw new Error(`ChainlinkPricing ${pricingId} returned no USD value.`);

  const health = new ContractCallQuery()
    .setContractId(ContractId.fromString(pricingId))
    .setGas(300_000)
    .setFunction("feedHealth");
  const healthResult = await health.execute(client);
  const rateUsdMicrosPerHbar = healthResult.getUint256(2)?.toNumber() ?? null;

  return { priceUsdMicros: usdMicros, priceFeedRateUsdMicrosPerHbar: rateUsdMicrosPerHbar };
}

async function main() {
  const topicIdRaw = process.env.HEDERA_TOPIC_ID;
  if (!topicIdRaw) throw new Error("HEDERA_TOPIC_ID must be set in .env.");

  const { client, network, mirrorUrl, operatorId } = operatorClient();
  const topicId = TopicId.fromString(topicIdRaw);

  const amountTinybar = 1_000_000;
  const pricing = await resolvePricingMicros(client, amountTinybar);

  const record = {
    v: 2,
    type: "pay-per-prompt/fulfilment",
    interactionId: "sample-boot-record",
    promptHash: "0".repeat(64),
    amountTinybar,
    payer: operatorId,
    recipient: process.env.RECEIVER_ACCOUNT_ID ?? operatorId,
    model: process.env.OPENAI_MODEL ?? "manual",
    priceSource: pricing.priceUsdMicros !== undefined ? "chainlink" : undefined,
    priceUsdMicros: pricing.priceUsdMicros,
    priceFeedRateUsdMicrosPerHbar: pricing.priceFeedRateUsdMicrosPerHbar,
    status: "delivered",
    at: new Date().toISOString(),
  };

  console.log(`Submitting sample ledger record to ${topicId.toString()}...`);
  const tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify(record));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const sequenceNumber = receipt.topicSequenceNumber;

  console.log(`\nHCS message submitted`);
  console.log(`Topic:        ${topicId.toString()}`);
  console.log(`Sequence:     ${sequenceNumber?.toString()}`);
  console.log(`Transaction:  ${response.transactionId.toString()}`);
  console.log(`Mirror node:  ${mirrorUrl}/topics/${topicId.toString()}/messages/${sequenceNumber?.toString()}`);
  console.log(
    `HashScan:     https://hashscan.io/${network}/topic/${topicId.toString()}/message/${sequenceNumber?.toString()}`,
  );
  console.log(`Record:       ${JSON.stringify(record)}`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
