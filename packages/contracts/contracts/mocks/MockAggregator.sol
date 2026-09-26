// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockAggregator
 * @notice Test double for a Chainlink AggregatorV3 feed (never deployed to a
 *         real network). `updatedAt` is derived from the block timestamp so
 *         tests can simulate a stale feed by setting a large offset.
 */
contract MockAggregator {
    uint8 private immutable decimals_;
    uint80 private immutable roundId_;
    int256 private immutable answer_;

    /// @notice `updatedAt = block.timestamp - updatedAtOffsetSeconds`.
    uint256 public updatedAtOffsetSeconds;

    constructor(uint8 _decimals, uint80 _roundId, int256 _answer, uint256 _updatedAtOffsetSeconds) {
        decimals_ = _decimals;
        roundId_ = _roundId;
        answer_ = _answer;
        updatedAtOffsetSeconds = _updatedAtOffsetSeconds;
    }

    function setUpdatedAtOffsetSeconds(uint256 value) external {
        updatedAtOffsetSeconds = value;
    }

    function decimals() external view returns (uint8) {
        return decimals_;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        uint256 updatedAt = block.timestamp > updatedAtOffsetSeconds ? block.timestamp - updatedAtOffsetSeconds : 0;
        return (roundId_, answer_, updatedAt, updatedAt, roundId_);
    }
}