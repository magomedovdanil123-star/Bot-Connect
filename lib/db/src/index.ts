import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { getDatabaseUrl } from "./database-url";

const { Pool } = pg;
const configuredDatabaseUrl = getDatabaseUrl();

if (!configuredDatabaseUrl) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set. Configure a PostgreSQL database connection first.",
  );
}

export const pool = new Pool({ connectionString: configuredDatabaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
