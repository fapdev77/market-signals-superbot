import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/backtest_db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:data/backtest.db',
  }
});
