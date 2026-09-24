import { artifacts } from "hardhat";
import { ContractCreateFlow, ContractFunctionParameters } from "@hashgraph/sdk";
import { extractNumericId, networkShortName, operatorClient } from "./lib/sdk";

async function main() {
  const topicIdRaw = process.env.HEDERA_TOPIC_ID;
  if (!topicIdRaw) {
    throw new Error(
      "HEDERA_TOPIC_ID must be set in .env first. Create the topic with `npm run setup:hedera` or `npm run create-topic -w @pay-per-prompt/contracts`.",
    );
  }

  const { client, network } = operatorClient();
  const topicNumeric = extractNumericId(topicIdRaw);
  const label = networkShortName(network);

  console.log(`Reading compiled artifact for LedgerRegistry...`);
  const artifact = await artifacts.readArtifact("LedgerRegistry");
  const bytecode = artifact.bytecode;

  console.log(`Deploying LedgerRegistry with topicId=${topicNumeric} label="${label}"...`);

  const tx = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(400_000)
    .setMaxChunks(20)
    .setConstructorParameters(new ContractFunctionParameters().addUint64(topicNumeric).addString(label));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;

  if (!contractId) throw new Error("Contract create receipt did not include a contract id.");

  console.log(`\nLedgerRegistry deployed!`);
  console.log(`Contract id: ${contractId.toString()}`);
  console.log(`Topic pinned: ${topicIdRaw}`);
  console.log(
    `Mirror node: ${network === "testnet" ? "https://testnet.mirrornode.hedera.com" : "https://mainnet-public.mirrornode.hedera.com"}/api/v1/contracts/${contractId.toString()}`,
  );
  console.log(`HashScan: https://hashscan.io/${network}/contract/${contractId.toString()}`);
  console.log(`\nSet this value in your .env:\n  HEDERA_CONTRACT_ID=${contractId.toString()}\n`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
