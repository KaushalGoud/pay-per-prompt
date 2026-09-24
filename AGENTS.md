# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this is

A scaffold-hbar template: a Next.js + Hardhat monorepo for a pay-per-prompt AI app on Hedera testnet.
Every prompt is (1) paid for with HBAR through x402 (exact scheme, Blocky402 facilitator), and (2) appended
to a public HCS audit ledger whose topic id is pinned on-chain by `LedgerRegistry.sol`.

The Hedera integration is **load-bearing**, not decorative:

- `packages/frontend/app/api/ask/route.ts` appends to HCS **before** returning the answer; an append failure
  returns `502`, and `withX402` treats `>= 400` responses as "cancel — do not settle".
- The server resolves the ledger topic from the deployed contract (`ContractCallQuery topicId()`) and fails
  closed on any mismatch with `HEDERA_TOPIC_ID`.

## Repo layout

```
template.json             # scaffold-hbar manifest (capabilities / defaults / envVars / outro)
packages/contracts/       # Hardhat + @hashgraph/sdk: LedgerRegistry.sol + scripts + test
packages/frontend/        # Next.js App Router: /api/ask, /api/health, /api/ledger, UI
.env.example              # single source of truth for env var docs (repo-root .env)
```

Env vars live in a single repo-root `.env` (gitignored). `packages/contracts/scripts/lib/sdk.ts` and
`packages/frontend/next.config.mjs` load it explicitly (dotenv), because both run from inside their package
dirs.

## Commands (from repo root, npm workspaces)

| Task                                 | Command                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Install                              | `npm install`                                                           |
| Dev server                           | `npm run dev` (http://localhost:3000)                                   |
| Build                                | `npm run build`                                                         |
| Lint                                 | `npm run lint`                                                          |
| Typecheck                            | `npm run typecheck`                                                     |
| Format                               | `npm run format` (root prettier) — **required** by the scaffold CLI run |
| Contracts test (offline)             | `npm run test`                                                          |
| Provision testnet (topic + registry) | `npm run setup:hedera`                                                  |
| Deploy registry alone                | `npm run deploy:registry`                                               |
| Submit a sample HCS record           | `npm run test:testnet`                                                  |

## Conventions

- Both packages pin `engines.node >= 20.18.3`; keep the toolchain conservative (TypeScript 5.7, hardhat 2.x,
  next 16.x). Node used in this repo: ≥ 20.18.3, installed is newer.
- Plain npm workspaces — **no pnpm, no yarn** (scaffold-hbar CLI only supports npm/yarn).
- `packages/*` are independent npm packages named `@pay-per-prompt/contracts` / `@pay-per-prompt/frontend`;
  root scripts delegate with `-w`.
- Solidity is pinned to 0.8.24 in `hardhat.config.ts`.
- Prefer the Hedera SDK (`@hashgraph/sdk`) over ethers for testnet transactions (scripts use
  `ContractCreateFlow`); ethers is used only for offline tests.
- Client-side x402 note: `@x402/hedera`'s default-asset registry lists USDC, not HBAR, so the client scheme
  allowlists `0.0.0` via `spendControls` (see `packages/frontend/lib/x402-hedera-client.ts`).

## Rules

- Never commit `.env` or any private key. `.env.example` is the documented template.
- The scaffold CLI (create-scaffold-hbar) deletes `template.json` after processing; treat it as living in
  this source repo only. Keep `outro` steps aligned with the actual npm scripts (`{run:setup:hedera}` etc).
- After touching shared configs, run `npm run lint && npm run typecheck && npm run test && npm run build`
  before finishing. Fix, don't silence.
- Real testnet runs cost/consume HBAR; only run provisioning when a funded operator is present.
