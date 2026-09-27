import "server-only";
import { createPrismaClient } from "./db-client";

type Client = ReturnType<typeof createPrismaClient>;

// One client per server instance, reused across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Client };

function client(): Client {
  globalForDb.db ??= createPrismaClient();
  return globalForDb.db;
}

/**
 * The Prisma client, created on first use. Importing this module never needs
 * DATABASE_URL, so `next build` works without database credentials.
 */
export const db: Client = new Proxy({} as Client, {
  get(_target, property) {
    const real = client();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Db = Client;
export type Tx = Parameters<Parameters<Client["$transaction"]>[0]>[0];

/** Close the connection pool if one was opened, e.g. before a test worker exits. */
export async function disconnectDb(): Promise<void> {
  const open = globalForDb.db;
  globalForDb.db = undefined;
  await open?.$disconnect();
}
