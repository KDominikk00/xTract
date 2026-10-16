# Supabase migrations

SQL lives in `migrations/` using the Supabase CLI naming (`<timestamp>_<name>.sql`), applied in order.
All files are idempotent, so they are safe to re-run.

New project / new database:

```bash
supabase link --project-ref <ref>
supabase db push
```

Existing database where these were already run by hand in the SQL editor: mark them as applied first so
the CLI does not try to re-run them, then push only newer ones.

```bash
supabase migration repair --status applied 20260220000000 20260221000000 20260221000001
supabase db push
```

Add new changes as a new timestamped file; do not edit applied migrations.
