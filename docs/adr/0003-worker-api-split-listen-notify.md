# Separate ingestion worker, fanned out via Postgres LISTEN/NOTIFY and SSE

One NestJS codebase has two entrypoints:

- **`main.worker.ts`:** polls Renfe, normalizes the data, writes it, then calls `NOTIFY`.
- **`main.api.ts`:** `LISTEN`s and pushes updates to browsers over SSE (an initial snapshot, then diffs).

This keeps polling independent of HTTP traffic without adding Redis or a message bus. We chose SSE over WebSockets because the data only flows from server to client.
