import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppConfigModule } from '../config/app-config.module.js';
import type { Env } from '../config/env.js';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export const DB = Symbol('DB');
const SQL_CLIENT = Symbol('SQL_CLIENT');

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        postgres(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DB,
      inject: [SQL_CLIENT],
      useFactory: (sql: postgres.Sql): Database => drizzle(sql, { schema }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly sql: postgres.Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end();
  }
}
