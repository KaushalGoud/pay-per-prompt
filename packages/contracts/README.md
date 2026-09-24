# @pay-per-prompt/contracts

Smart contracts and Hedera provisioning scripts for pay-per-prompt.

The package holds the **on-chain anchor** of the app's public audit ledger: a
tiny Solidity contract (`LedgerRegistry`) that immutably records which HCS
topic backs every fulfilled prompt. Because the topic id lives on-chain, the
frontend refuses to serve an answer unless the anchor matches the topic it
appends to — the public record cannot be silently repointed.

## Layout

```
contracts/
├── contracts/
│   └── LedgerRegistry.sol      # On-chain anchor: immutable topicId + label + deployer
├── scripts/
│   ├── lib/sdk.ts              # Shared Hedera SDK client + link helpers
│   ├── create-topic.ts         # Create the HCS ledger topic (submit key = operator)
│   ├── deploy-ledger-registry.ts # Deploy LedgerRegistry pinning the topic
│   ├── setup.ts                # Idempotent one-shot: topic + registry, prints .env lines
│   └── submit-test-message.ts  # Push a sample record to prove ledger append works
└── test/
    └── LedgerRegistry.test.ts  # Hardhat (in-process EVM) tests
```

## Environment variables

Read from the **repo-root** `.env` via `dotenv` (all scripts chdir-expect the
root). Only two are strictly required for provisioning:

| Variable             | Purpose                               |
| -------------------- | ------------------------------------- |
| `HEDERA_ACCOUNT_ID`  | Operator account (e.g. `0.0.9567368`) |
| `HEDERA_PRIVATE_KEY` | Operator ECDSA private key (raw hex)  |
| `HEDERA_NETWORK`     | `testnet` (default) or `mainnet`      |

Optional overrides: `HEDERA_MIRROR_NODE_URL`, `HEDERA_TESTNET_RPC_URL`,
`HEDERA_MAINNET_RPC_URL`.

## Commands

Run from the workspace root (`npm run <script> -w @pay-per-prompt/contracts`)
or from this directory.

```bash
npm install                          # from repo root
npm run compile -w @pay-per-prompt/contracts   # hardhat compile
npm run test -w @pay-per-prompt/contracts      # hardhat test (no network needed)
npm run typecheck -w @pay-per-prompt/contracts
npm run lint -w @pay-per-prompt/contracts

# Hedera (testnet) provisioning
npm run setup:hedera                 # create topic + deploy registry (idempotent)
npm run create-topic -w @pay-per-prompt/contracts
npm run deploy:registry -w @pay-per-prompt/contracts
npm run test:testnet -w @pay-per-prompt/contracts  # submit a sample HCS message
```

The scripts print HashScan and mirror-node links so every transaction is
independently verifiable. Copy the emitted `HEDERA_TOPIC_ID` /
`HEDERA_CONTRACT_ID` lines into your root `.env`.

## Why only one contract?

Before it ships it should do more work, not more ceremony. Deployment is
deliberately small: a constructor-only registry is the smallest on-chain
artifact that makes the server's HCS writes verifiable by third parties.
