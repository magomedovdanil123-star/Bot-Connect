import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL or DATABASE_URL, ensure the database is provisioned");
}

const normalizedDatabaseUrl = databaseUrl.replace(/([?&])sslmode=[^&]*&?/i, (_, prefix: string, suffix: string) => (
  prefix === "?" && suffix ? "?" : ""
));

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: normalizedDatabaseUrl,
  },
});
