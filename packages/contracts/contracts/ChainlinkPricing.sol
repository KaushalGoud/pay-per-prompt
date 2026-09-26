// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ChainlinkAggregatorV3
 * @notice Minimal Chainlink AggregatorV3 interface (the section the gate uses).
 */
interface ChainlinkAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title ChainlinkPricing
 * @notice On-chain fair-price gate for the pay-per-prompt ledger.
 *
 * @dev Every fulfilled prompt is priced against the live Chainlink HBAR/USD
 *      feed before the payment can settle. The oracle read is load-bearing:
 *      a stale, silent or non-positive feed makes every pricing call revert,
 *      so the app cannot price (or settle) a single prompt without a healthy
 *      oracle. The feed address, staleness window and USD floor are frozen at
 *      deployment (immutables) and cannot be repointed by anyone.
 *
 *      Amounts are expressed in "micro-dollars" (USD * 1e6) to avoid floats.
 *      The feed reports USD per HBAR with 8 decimals (1 HBAR = 1e8 tinybar).
 */
contract ChainlinkPricing {
    /// @notice Micro-dollars per USD (scaling for integer math).
    uint256 public constant MICROS_PER_USD = 1_000_000;

    /// @notice Tinybar per HBAR (Hedera native precision).
    uint256 public constant TINYBAR_PER_HBAR = 100_000_000;

    /// @notice Chainlink AggregatorV3 address (e.g. HBAR/USD on testnet).
    address public immutable priceFeed;

    /// @notice Maximum acceptable age of the latest round, in seconds.
    uint256 public immutable maxStalenessSeconds;

    /// @notice Minimum acceptable payment value, in micro-dollars.
    uint256 public immutable minUsdMicros;

    /// @notice EVM address that deployed this pricing gate.
    address public immutable deployer;

    /// @notice Emitted once at deployment with the frozen configuration.
    event PricingConfigured(address indexed priceFeed, uint256 maxStalenessSeconds, uint256 minUsdMicros);

    /**
     * @param feed_            Chainlink AggregatorV3 feed for HBAR/USD.
     * @param maxStalenessSeconds_ Freshness window before the feed is treated
     *                             as silent and the gate fails closed.
     * @param minUsdMicros_    Minimum payment value in micro-dollars (USD*1e6).
     */
    constructor(address feed_, uint256 maxStalenessSeconds_, uint256 minUsdMicros_) {
        require(feed_ != address(0), "ChainlinkPricing: price feed is required");
        require(maxStalenessSeconds_ > 0, "ChainlinkPricing: staleness window must be > 0");
        uint8 decimals_ = ChainlinkAggregatorV3(feed_).decimals();
        require(decimals_ == 8, "ChainlinkPricing: feed must report 8 decimals");

        priceFeed = feed_;
        deployer = msg.sender;
        maxStalenessSeconds = maxStalenessSeconds_;
        minUsdMicros = minUsdMicros_;
        emit PricingConfigured(feed_, maxStalenessSeconds_, minUsdMicros_);
    }

    /**
     * @notice Reads the latest feed round and enforces the freshness window.
     * @dev Reverts when the oracle looks unhealthy, never returns a stale rate.
     */
    function _latestRound()
        internal
        view
        returns (uint80 roundId, uint256 answer, uint256 updatedAt)
    {
        (uint80 roundId_, int256 answer_, , uint256 updatedAt_, ) = ChainlinkAggregatorV3(priceFeed)
            .latestRoundData();
        require(roundId_ > 0, "ChainlinkPricing: no round yet");
        require(answer_ > 0, "ChainlinkPricing: non-positive price");
        require(updatedAt_ > 0 && block.timestamp <= updatedAt_ + maxStalenessSeconds, "ChainlinkPricing: stale feed");
        return (roundId_, uint256(answer_), updatedAt_);
    }

    /**
     * @notice Latest HBAR/USD rate in micro-dollars per HBAR.
     */
    function usdMicrosPerHbar() public view returns (uint256) {
        (, uint256 answer, ) = _latestRound();
        return (answer * MICROS_PER_USD) / 1e8;
    }

    /**
     * @notice USD value of `tinybarAmount` in micro-dollars.
     */
    function usdMicrosValue(uint64 tinybarAmount) public view returns (uint256) {
        return (uint256(tinybarAmount) * usdMicrosPerHbar()) / TINYBAR_PER_HBAR;
    }

    /**
     * @notice Enforces the fair-price floor for a payment.
     * @return passed     True when the payment is worth at least `minUsdMicros`.
     * @return usdMicros The on-chain USD value of the payment.
     * @dev Callers must treat a revert as "do not serve". No price, no prompt.
     */
    function paymentGate(uint64 tinybarAmount) external view returns (bool passed, uint256 usdMicros) {
        uint256 value = usdMicrosValue(tinybarAmount);
        return (value >= minUsdMicros, value);
    }

    /**
     * @notice Diagnostic for /api/health: reverts unless the feed is healthy.
     * @return roundId         Identifier of the latest round.
     * @return updatedAt       Feed update timestamp.
     * @return rateUsdMicrosPerHbar Current on-chain rate, micro-dollars per HBAR.
     */
    function feedHealth()
        external
        view
        returns (uint80 roundId, uint256 updatedAt, uint256 rateUsdMicrosPerHbar)
    {
        (uint80 roundId_, uint256 answer_, uint256 updatedAt_) = _latestRound();
        return (roundId_, updatedAt_, (answer_ * MICROS_PER_USD) / 1e8);
    }
}