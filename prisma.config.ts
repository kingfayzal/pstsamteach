import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * The CLI (migrations) connects directly: DIRECT_URL, which on Supabase is the
 * session pooler or direct connection. The app itself uses DATABASE_URL, the
 * transaction pooler, via the driver adapter in src/server/db-client.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Fallback keeps `npm install` (which runs `prisma generate`) working before .env exists.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach",
  },
});
