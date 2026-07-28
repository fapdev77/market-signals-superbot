import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import path from 'path';

// Store the database file in the project root
const dbPath = path.resolve(process.cwd(), 'backtest.db');

export const client = createClient({
  url: `file:${dbPath}`
});

export const db = drizzle(client, { schema });
