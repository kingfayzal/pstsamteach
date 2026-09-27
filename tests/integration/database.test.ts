import { describe, expect, it } from "vitest";
import { db } from "@/server/db";

describe("database safety", () => {
  // Supabase serves the public schema through its Data API. With row-level security on
  // and no policies, that API sees nothing; the app connects as the owner, so it isn't affected.
  it("keeps row-level security on for every table, so new migrations must enable it too", async () => {
    const tables = await db.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = current_schema()`;
    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter((table) => !table.rowsecurity).map((table) => table.tablename)).toEqual([]);
  });
});
