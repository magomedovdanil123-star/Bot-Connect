import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const configuredDatabaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!configuredDatabaseUrl) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set. Configure a PostgreSQL database connection first.",
  );
}

const databaseUrl = configuredDatabaseUrl.replace(/([?&])sslmode=[^&]*&?/i, (_, prefix: string, suffix: string) => (
  prefix === "?" && suffix ? "?" : ""
));

export const pool = new Pool({
  connectionString: databaseUrl,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
