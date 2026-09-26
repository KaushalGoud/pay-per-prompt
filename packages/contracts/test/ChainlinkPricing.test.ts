import { expect } from "chai";
import { ethers } from "hardhat";

const FEED_ANSWER = 9_322_392n; // HBAR/USD with 8 decimals (~$0.0932)

describe("ChainlinkPricing", function () {
  const STALENESS = 3600n;
  const MIN_USD_MICROS = 500n;

  async function deployPricing(feedAddress: string, staleness = STALENESS, minUsdMicros = MIN_USD_MICROS) {
    const factory = await ethers.getContractFactory("ChainlinkPricing");
    const pricing = await factory.deploy(feedAddress, staleness, minUsdMicros);
    await pricing.waitForDeployment();
    return pricing;
  }

  async function deployFeed(decimals = 8, answer = FEED_ANSWER, offsetSeconds = 60n) {
    const factory = await ethers.getContractFactory("MockAggregator");
    const feed = await factory.deploy(decimals, 42n, answer, offsetSeconds);
    await feed.waitForDeployment();
    return feed;
  }

  async function expectRevert(fn: () => Promise<unknown>, fragment: string): Promise<void> {
    try {
      await fn();
      expect.fail("expected the call to revert");
    } catch (err) {
      expect((err as Error).message).to.contain(fragment);
    }
  }

  it("freezes price feed, staleness window and USD floor at construction", async function () {
    const [owner] = await ethers.getSigners();
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress());

    expect(await pricing.priceFeed()).to.equal(await feed.getAddress());
    expect(await pricing.maxStalenessSeconds()).to.equal(STALENESS);
    expect(await pricing.minUsdMicros()).to.equal(MIN_USD_MICROS);
    expect(await pricing.deployer()).to.equal(owner.address);
  });

  it("rejects a feed that does not report 8 decimals", async function () {
    const feed = await deployFeed(18);
    await expectRevert(async () => {
      const factory = await ethers.getContractFactory("ChainlinkPricing");
      const pricing = await factory.deploy(await feed.getAddress(), STALENESS, MIN_USD_MICROS);
      await pricing.waitForDeployment();
    }, "feed must report 8 decimals");
  });

  it("rejects a zero feed and a zero staleness window", async function () {
    const factory = await ethers.getContractFactory("ChainlinkPricing");
    await expectRevert(async () => {
      const pricing = await factory.deploy(ethers.ZeroAddress, STALENESS, MIN_USD_MICROS);
      await pricing.waitForDeployment();
    }, "price feed is required");
    await expectRevert(async () => {
      const pricing = await factory.deploy(await (await deployFeed()).getAddress(), 0n, MIN_USD_MICROS);
      await pricing.waitForDeployment();
    }, "staleness window must be > 0");
  });

  it("computes the HBAR/USD rate in micro-dollars per HBAR", async function () {
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress());

    const rate = await pricing.usdMicrosPerHbar();
    expect(rate).to.equal(93223n); // 9_322_392 * 1e6 / 1e8
  });

  it("computes the USD value of a tinybar payment", async function () {
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress());

    expect(await pricing.usdMicrosValue(1_000_000n)).to.equal(932n); // 0.01 HBAR
    expect(await pricing.usdMicrosValue(0n)).to.equal(0n);
  });

  it("passes a payment at or above the USD floor", async function () {
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress(), STALENESS, 900n);

    const gate = await pricing.paymentGate(1_000_000n);
    expect(gate[0]).to.equal(true);
    expect(gate[1]).to.equal(932n);
  });

  it("fails a payment below the USD floor", async function () {
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress(), STALENESS, 1000n);

    const gate = await pricing.paymentGate(1_000_000n);
    expect(gate[0]).to.equal(false);
    expect(gate[1]).to.equal(932n);
  });

  it("fails closed on a stale feed instead of quoting a stale price", async function () {
    const feed = await deployFeed(8, FEED_ANSWER, 60n);
    const pricing = await deployPricing(await feed.getAddress(), STALENESS, 500n);

    await feed.setUpdatedAtOffsetSeconds(7200n); // older than the 1h window
    await expectRevert(() => pricing.paymentGate(1_000_000n), "stale feed");
    await expectRevert(() => pricing.usdMicrosPerHbar(), "stale feed");
    await expectRevert(() => pricing.feedHealth(), "stale feed");
  });

  it("fails closed when the feed reports a non-positive price", async function () {
    const feed = await deployFeed(8, 0n, 60n);
    const pricing = await deployPricing(await feed.getAddress(), STALENESS, 500n);

    await expectRevert(() => pricing.paymentGate(1_000_000n), "non-positive price");
  });

  it("reports the latest round and rate for health checks", async function () {
    const feed = await deployFeed();
    const pricing = await deployPricing(await feed.getAddress());

    const health = await pricing.feedHealth();
    expect(health[0]).to.equal(42n);
    expect(health[1] > 0n).to.equal(true);
    expect(health[2]).to.equal(93223n);
  });
});
