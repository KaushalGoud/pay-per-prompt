import { TopicCreateTransaction } from "@hashgraph/sdk";
import { operatorClient } from "./lib/sdk";

async function main() {
  const { client, network, mirrorUrl, operatorId, operatorPublicKey } = operatorClient();

  const tx = new TopicCreateTransaction()
    .setTopicMemo(`pay-per-prompt ledger (${network}) — every fulfilled prompt is appended here`)
    .setSubmitKey(operatorPublicKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId;

  if (!topicId) throw new Error("Topic create receipt did not include a topic id.");

  console.log(`\nHCS topic created: ${topicId.toString()}`);
  console.log(`Memo: pay-per-prompt ledger (${network})`);
  console.log(`Submit key: operator (${operatorId}) — only the operator can append.`);
  console.log(`Mirror node: ${mirrorUrl}/api/v1/topics/${topicId.toString()}`);
  console.log(`HashScan: https://hashscan.io/${network}/topic/${topicId.toString()}`);
  console.log(`\nSet this value in your .env:\n  HEDERA_TOPIC_ID=${topicId.toString()}\n`);

  const check = await fetch(`${mirrorUrl}/api/v1/topics/${topicId.toString()}`);
  if (check.ok) console.log("Topic confirmed on mirror node. ✅");
  else console.log(`Warning: mirror node lookup returned HTTP ${check.status}.`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
