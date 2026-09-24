import { expect } from "chai";
import { ethers } from "hardhat";

describe("LedgerRegistry", function () {
  it("pins topic id, label and deployer at construction", async function () {
    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("LedgerRegistry");
    const registry = await factory.deploy(1234567n, "payperprompt:testnet");
    await registry.waitForDeployment();

    expect(await registry.topicId()).to.equal(1234567n);
    expect(await registry.label()).to.equal("payperprompt:testnet");
    expect(await registry.deployer()).to.equal(owner.address);
    expect(Number(await registry.pinnedAt())).to.be.greaterThan(0);
  });

  it("anchors() reflects the pinned topic id", async function () {
    const factory = await ethers.getContractFactory("LedgerRegistry");
    const registry = await factory.deploy(1234567n, "payperprompt:testnet");
    await registry.waitForDeployment();

    expect(await registry.anchors(1234567n)).to.equal(true);
    expect(await registry.anchors(123456n)).to.equal(false);
  });

  it("reverts when the topic id is zero", async function () {
    const factory = await ethers.getContractFactory("LedgerRegistry");
    let reverted = false;
    try {
      const registry = await factory.deploy(0n, "bad");
      await registry.waitForDeployment();
    } catch {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });
});
