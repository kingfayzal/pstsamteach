-- Supabase serves the public schema through its Data API, where the anon key is
-- public by design. Row-level security with no policies hides every table from
-- that API. The app connects as the tables' owner, which RLS doesn't restrict.
-- New tables need the same: ALTER TABLE "Name" ENABLE ROW LEVEL SECURITY;
-- (tests/integration/database.test.ts fails until they have it).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
