# Spain Trains Tracker

Live and historical view of Renfe trains across Spain, built from Renfe's open data feeds.
See [`GLOSSARY.md`](./GLOSSARY.md) for domain language and [`docs/adr/`](./docs/adr) for architecture decisions.

## Getting started

### Prerequisites

- **Node.js 24**: the version is pinned in [`.nvmrc`](./.nvmrc), so run `nvm use` (or `fnm use`).
- **pnpm**: the version is pinned in `package.json` (`packageManager`). Run `corepack enable` and it is picked up automatically.
- **Docker**: needed to run the local Postgres + TimescaleDB + PostGIS database.

### Install and verify

```sh
pnpm install
pnpm turbo lint typecheck test
```

### Workspace layout

```
apps/       # deployable apps (web, api)
packages/   # shared libraries (@stt/contracts, ...)
```

### Common scripts

| Command          | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `pnpm build`     | Build every workspace via Turborepo                  |
| `pnpm dev`       | Run every workspace's `dev` task                     |
| `pnpm lint`      | Biome lint + format check over the whole repo        |
| `pnpm lint:fix`  | Apply Biome's safe fixes and formatting              |
| `pnpm typecheck` | `tsc --noEmit` in every workspace                    |
| `pnpm test`      | Vitest in every workspace (or `pnpm vitest` at root) |

### Adding a workspace

Each workspace under `apps/` or `packages/` should:

- extend `../../tsconfig.base.json` from its own `tsconfig.json`,
- define a `vitest.config.ts` using `defineProject` (the root config picks it up),
- expose `lint`, `typecheck` and `test` scripts so Turborepo can run them.
