---
name: Supabase DDL setup
description: Supabase REST service keys do not create tables; schema changes require a Postgres connection or SQL Editor.
---

Supabase REST and Storage access are separate from PostgreSQL DDL. The service role key can operate on configured tables and private Storage, but it cannot create the tables themselves.

**Why:** Startup checks initially returned PostgREST schema-cache errors until the idempotent SQL schema was executed through a PostgreSQL connection.

**How to apply:** Keep the SQL migration in the repository, use a protected Postgres pooler connection only for migrations, never print credentials, and verify the API startup log reports Supabase persistence as ready.