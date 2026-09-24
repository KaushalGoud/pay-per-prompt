import { artifacts } from "hardhat";
import { ContractCreateFlow, ContractFunctionParameters, TopicCreateTransaction } from "@hashgraph/sdk";
import { extractNumericId, networkShortName, operatorClient } from "./lib/sdk";

/**
 * One-shot provisioning for the two load-bearing Hedera services:
 *   1. Creates the HCS ledger topic when HEDERA_TOPIC_ID is not set.
 *   2. Deploys the LedgerRegistry contract (pinning the topic) when
 *      HEDERA_CONTRACT_ID is not set.
 * Prints the exact .env lines to copy. Re-running is safe — already-set
 * values are left untouched.
 */
async function main() {
  const { client, network } = operatorClient();

  let topicIdRaw = process.env.HEDERA_TOPIC_ID?.trim();
  if (!topicIdRaw) {
    console.log("HEDERA_TOPIC_ID not set — creating a new HCS topic...");
    const topicTx = new TopicCreateTransaction().setTopicMemo(
      `pay-per-prompt ledger (${network}) — every fulfilled prompt is appended here`,
    );
    const topicResponse = await topicTx.execute(client);
    const topicReceipt = await topicResponse.getReceipt(client);
    if (!topicReceipt.topicId) throw new Error("Topic create receipt did not include a topic id.");
    topicIdRaw = topicReceipt.topicId.toString();
    console.log(`Created topic ${topicIdRaw} ✅`);
  } else {
    console.log(`Using existing HEDERA_TOPIC_ID=${topicIdRaw}`);
  }

  let contractIdRaw = process.env.HEDERA_CONTRACT_ID?.trim();
  if (!contractIdRaw) {
    console.log("HEDERA_CONTRACT_ID not set — deploying LedgerRegistry...");
    const artifact = await artifacts.readArtifact("LedgerRegistry");
    const topicNumeric = extractNumericId(topicIdRaw);
    const deployTx = new ContractCreateFlow()
      .setBytecode(artifact.bytecode)
      .setGas(400_000)
      .setMaxChunks(20)
      .setConstructorParameters(
        new ContractFunctionParameters().addUint64(topicNumeric).addString(networkShortName(network)),
      );
    const deployResponse = await deployTx.execute(client);
    const deployReceipt = await deployResponse.getReceipt(client);
    if (!deployReceipt.contractId) throw new Error("Contract create receipt did not include a contract id.");
    contractIdRaw = deployReceipt.contractId.toString();
    console.log(`Deployed registry ${contractIdRaw} ✅`);
  } else {
    console.log(`Using existing HEDERA_CONTRACT_ID=${contractIdRaw}`);
  }

  console.log(`\nAdd these to your .env:\n`);
  console.log(`  HEDERA_TOPIC_ID=${topicIdRaw}`);
  console.log(`  HEDERA_CONTRACT_ID=${contractIdRaw}`);
  console.log(`\nLinks:`);
  console.log(`  Topic:     https://hashscan.io/${network}/topic/${topicIdRaw}`);
  console.log(`  Contract:  https://hashscan.io/${network}/contract/${contractIdRaw}`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
