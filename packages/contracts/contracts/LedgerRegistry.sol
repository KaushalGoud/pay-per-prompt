// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LedgerRegistry
 * @notice On-chain anchor for the pay-per-prompt HCS audit ledger.
 *
 * @dev The app refuses to release an answer unless it can resolve the HCS
 *      topic id from this contract. Keeping the anchor on-chain means the
 *      public ledger a user verifies against cannot be silently repointed by
 *      anyone — not even the deployer — after deployment.
 *
 *      Solidity version is pinned in hardhat.config.ts to 0.8.24.
 */
contract LedgerRegistry {
    /// @notice The topic id (in decimal form) that anchors the public ledger.
    uint64 public immutable topicId;

    /// @notice Short human-readable label, e.g. "payperprompt:testnet".
    /// @dev A dynamic string cannot be `immutable` in Solidity; it is set once
    ///      in the constructor and there is no setter, so it is effectively
    ///      constant on-chain.
    string public label;

    /// @notice EVM address that deployed this registry.
    address public immutable deployer;

    /// @notice Block timestamp at deployment.
    uint64 public immutable pinnedAt;

    /// @notice Emitted once on deployment so the anchor is discoverable in logs.
    event LedgerPinned(uint64 indexed topicId, string label, address indexed deployer);

    /**
     * @param topicId_ HCS topic id in decimal form (e.g. 0.0.1234567 -> 1234567).
     * @param label_   Human-readable label for this ledger.
     */
    constructor(uint64 topicId_, string memory label_) {
        require(topicId_ > 0, "LedgerRegistry: topicId must be > 0");
        topicId = topicId_;
        label = label_;
        deployer = msg.sender;
        pinnedAt = uint64(block.timestamp);
        emit LedgerPinned(topicId_, label_, msg.sender);
    }

    /**
     * @notice Returns true when `topicId_` matches the anchored topic.
     * @dev Convenience helper so callers can assert the on-chain anchor
     *      without casting the uint64 themselves.
     */
    function anchors(uint64 topicId_) external view returns (bool) {
        return topicId_ == topicId;
    }
}