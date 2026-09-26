import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Fallback keeps `npm install` (which runs `prisma generate`) working before .env exists.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
