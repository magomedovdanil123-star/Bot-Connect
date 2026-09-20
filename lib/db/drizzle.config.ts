import { defineConfig } from "drizzle-kit";
import path from "path";
import { getDatabaseUrl } from "./src/database-url";

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL or DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
