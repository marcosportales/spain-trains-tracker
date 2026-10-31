import { DEFAULT_DATABASE_URL, runMigrations } from './migrate.js';

await runMigrations({ databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL });
console.log('migrations applied');
