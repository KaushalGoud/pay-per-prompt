import { TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { operatorClient } from "./lib/sdk";

async function main() {
  const topicIdRaw = process.env.HEDERA_TOPIC_ID;
  if (!topicIdRaw) throw new Error("HEDERA_TOPIC_ID must be set in .env.");

  const { client, network, mirrorUrl, operatorId } = operatorClient();
  const topicId = TopicId.fromString(topicIdRaw);

  const record = {
    v: 1,
    type: "pay-per-prompt/fulfilment",
    interactionId: "sample-boot-record",
    promptHash: "0".repeat(64),
    amountTinybar: 1_000_000,
    payer: operatorId,
    recipient: process.env.RECEIVER_ACCOUNT_ID ?? operatorId,
    model: process.env.OPENAI_MODEL ?? "manual",
    status: "delivered",
    at: new Date().toISOString(),
  };

  console.log(`Submitting sample ledger record to ${topicId.toString()}...`);
  const tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify(record));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const sequenceNumber = receipt.topicSequenceNumber;

  console.log(`\nHCS message submitted ✅`);
  console.log(`Topic:        ${topicId.toString()}`);
  console.log(`Sequence:     ${sequenceNumber?.toString()}`);
  console.log(`Transaction:  ${response.transactionId.toString()}`);
  console.log(`Mirror node:  ${mirrorUrl}/topics/${topicId.toString()}/messages/${sequenceNumber?.toString()}`);
  console.log(
    `HashScan:     https://hashscan.io/${network}/topic/${topicId.toString()}/message/${sequenceNumber?.toString()}`,
  );

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
