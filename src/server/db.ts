import "server-only";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const adapter = new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  return new PrismaClient({ adapter });
}

type Client = ReturnType<typeof createClient>;

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Client };

export const db: Client = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export type Db = Client;
export type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];
