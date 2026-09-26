---
name: Supabase DDL setup
description: Supabase REST service keys do not create tables; schema changes require a Postgres connection or SQL Editor.
---

Supabase REST and Storage access are separate from PostgreSQL DDL. The service role key can operate on configured tables and private Storage, but it cannot create the tables themselves.

**Why:** Startup checks initially returned PostgREST schema-cache errors until the idempotent SQL schema was executed through a PostgreSQL connection.

**How to apply:** Keep the SQL migration in the repository, use a protected Postgres pooler connection only for migrations, never print credentials, and verify the API startup log reports Supabase persistence as ready. The pooler username/project ref and `SUPABASE_URL` plus service-role key must all belong to the same Supabase project; a mismatched ref can return `tenant/user not found` or an invalid API key even when the host is reachable.

Drizzle push can stop in non-interactive environments when existing database table names create a schema-resolution prompt. Do not use force-push as a shortcut for an add-only change; apply a reviewed, idempotent SQL migration over the protected Postgres connection instead.

**Why:** A non-TTY push stopped before applying changes because it needed interactive conflict resolution, while the targeted `CREATE TABLE IF NOT EXISTS` migration completed without altering unrelated tables.

**How to apply:** Keep the migration source-controlled, bind any inserted values as SQL parameters, and verify the expected table/columns after execution.