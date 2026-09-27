// No `server-only` marker: the seed and admin scripts (plain Node) build clients here too.
// App code imports ./db, which wraps this behind `server-only`.
import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PRISMA_ONLY_PARAMS = ["sslmode", "pgbouncer", "schema", "connection_limit", "connect_timeout", "pool_timeout", "socket_timeout", "max_idle_connection_lifetime"];

/** Each serverless instance keeps a small pool; Supabase's pooler multiplexes them. */
function poolMax(): number {
  const configured = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  if (configured > 0) return configured;
  return process.env.VERCEL ? 3 : 10;
}

/**
 * node-postgres settings for a connection string.
 *
 * - Local databases connect without TLS.
 * - Remote ones (Supabase) always use TLS. With DATABASE_CA_CERT set (Supabase's
 *   root certificate, PEM) the server is verified; without it the connection is
 *   encrypted but unverified.
 * - `sslmode`, `pgbouncer` and Prisma's other URL options are stripped because
 *   node-postgres would otherwise let them override the settings above.
 * - Prisma's `schema` option (e.g. `?schema=test`, for tests sharing one local
 *   database) becomes the adapter schema plus the search path for raw SQL.
 */
export function poolConfig(connectionString: string): PoolConfig & { schema?: string } {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get("sslmode");
  const schema = url.searchParams.get("schema") || undefined;
  // It ends up in a startup option, where spaces would start new settings.
  if (schema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error("The schema in the database URL may only contain letters, digits and underscores.");
  }
  for (const param of PRISMA_ONLY_PARAMS) url.searchParams.delete(param);
  const local = LOCAL_HOSTS.has(url.hostname);
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl = local || sslmode === "disable" ? false : ca ? { ca } : { rejectUnauthorized: false };
  return {
    connectionString: url.toString(),
    ssl,
    ...(schema ? { schema, options: `-c search_path="${schema}"` } : {}),
    max: poolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env locally, or add it to the Vercel project settings.");
  }
  const { schema, ...config } = poolConfig(connectionString);
  return new PrismaClient({ adapter: new PrismaPg(config, schema ? { schema } : undefined) });
}
