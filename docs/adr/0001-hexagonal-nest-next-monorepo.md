# Hexagonal NestJS API + Next.js web in a pnpm/Turborepo monorepo

We use a pnpm + Turborepo monorepo with three parts:

- `apps/web`: Next.js 16.
- `apps/api`: NestJS 12, split into `domain/`, `application/` (use cases + ports) and `infrastructure/` (adapters).
- `packages/contracts`: shared Zod schemas.

The domain layer has no framework imports. This keeps Renfe's quirks (space-padded GTFS, a broken LD header timestamp, the unofficial visor) behind adapters, and lets the core be tested in isolation.

## Considered Options

- **Next.js only, using route handlers.** Simpler, but it has no natural home for a long-running ingestion process.
