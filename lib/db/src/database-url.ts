export function getDatabaseUrl(): string | undefined {
  const supabasePassword = process.env.SUPABASE_DB_PASSWORD;
  const supabaseHost = process.env.SUPABASE_DB_HOST;
  if (supabasePassword && supabaseHost) {
    const user = encodeURIComponent(process.env.SUPABASE_DB_USER || "postgres");
    const password = encodeURIComponent(supabasePassword);
    const port = process.env.SUPABASE_DB_PORT || "5432";
    const database = encodeURIComponent(process.env.SUPABASE_DB_NAME || "postgres");
    return `postgresql://${user}:${password}@${supabaseHost}:${port}/${database}`;
  }
  const configuredSupabaseUrl = process.env.SUPABASE_DB_URL;
  return configuredSupabaseUrl?.startsWith("postgres") ? configuredSupabaseUrl : process.env.DATABASE_URL;
}