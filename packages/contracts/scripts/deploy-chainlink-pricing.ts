import { artifacts } from "hardhat";
import { ContractCreateFlow, ContractFunctionParameters } from "@hashgraph/sdk";
import { operatorClient } from "./lib/sdk";

const DEFAULT_FEED = "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a"; // Chainlink HBAR/USD on Hedera testnet

async function main() {
  const { client, network } = operatorClient();

  const feed = process.env.CHAINLINK_PRICE_FEED?.trim() || DEFAULT_FEED;
  const staleness = Number(process.env.PRICING_MAX_STALE_SECONDS?.trim() || "3600");
  const minUsdMicros = Number(process.env.PRICING_MIN_USD_MICROS?.trim() || "500");

  console.log(`Reading compiled artifact for ChainlinkPricing...`);
  const artifact = await artifacts.readArtifact("ChainlinkPricing");
  const bytecode = artifact.bytecode;

  console.log(
    `Deploying ChainlinkPricing feed=${feed} staleness=${staleness}s minUsdMicros=${minUsdMicros} (USD*1e6)...`,
  );

  const tx = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(600_000)
    .setMaxChunks(20)
    .setConstructorParameters(
      new ContractFunctionParameters().addAddress(feed).addUint256(staleness).addUint256(minUsdMicros),
    );

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const contractId = receipt.contractId;

  if (!contractId) throw new Error("Contract create receipt did not include a contract id.");

  console.log(`\nChainlinkPricing deployed!`);
  console.log(`Contract id:  ${contractId.toString()}`);
  console.log(`HashScan:      https://hashscan.io/${network}/contract/${contractId.toString()}`);
  console.log(`\nSet this value in your .env:\n  HEDERA_PRICING_CONTRACT_ID=${contractId.toString()}\n`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
