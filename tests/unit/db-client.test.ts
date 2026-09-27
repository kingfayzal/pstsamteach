import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { poolConfig } from "@/server/db-client";

const SUPABASE_POOLER = "postgresql://postgres.abcdefgh@aws-0-eu-west-2.pooler.supabase.com:6543/postgres";

beforeEach(() => {
  vi.stubEnv("DATABASE_CA_CERT", undefined);
  vi.stubEnv("DATABASE_POOL_MAX", undefined);
  vi.stubEnv("VERCEL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("poolConfig", () => {
  it("connects to local databases without TLS", () => {
    expect(poolConfig("postgresql://postgres@localhost:5432/app").ssl).toBe(false);
    expect(poolConfig("postgresql://postgres@127.0.0.1:5432/app").ssl).toBe(false);
  });

  it("always encrypts remote connections", () => {
    expect(poolConfig(SUPABASE_POOLER).ssl).toEqual({ rejectUnauthorized: false });
  });

  it("verifies the server when a CA certificate is configured, accepting escaped newlines", () => {
    vi.stubEnv("DATABASE_CA_CERT", "-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----");
    expect(poolConfig(SUPABASE_POOLER).ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----" });
  });

  it("keeps remote TLS on even when the URL asks for sslmode=require, and strips Prisma-only options", () => {
    const config = poolConfig(`${SUPABASE_POOLER}?sslmode=require&pgbouncer=true&connection_limit=1`);
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).toBe(SUPABASE_POOLER);
  });

  it("turns TLS off only when sslmode=disable is explicit", () => {
    expect(poolConfig("postgresql://postgres@db.internal:5432/app?sslmode=disable").ssl).toBe(false);
  });

  it("maps Prisma's schema option to the adapter schema and the raw-SQL search path", () => {
    const config = poolConfig("postgresql://postgres@localhost:5432/app?schema=test");
    expect(config.schema).toBe("test");
    expect(config.options).toBe('-c search_path="test"');
    expect(config.connectionString).toBe("postgresql://postgres@localhost:5432/app");
    expect(poolConfig("postgresql://postgres@localhost:5432/app").schema).toBeUndefined();
  });

  it("rejects schema names that could smuggle extra startup settings", () => {
    expect(() => poolConfig("postgresql://postgres@localhost:5432/app?schema=x%20-c%20statement_timeout%3D0")).toThrow(/letters, digits and underscores/);
    expect(() => poolConfig('postgresql://postgres@localhost:5432/app?schema=a"b')).toThrow();
  });

  it("keeps pools small on Vercel and honours a valid override", () => {
    expect(poolConfig(SUPABASE_POOLER).max).toBe(10);
    vi.stubEnv("VERCEL", "1");
    expect(poolConfig(SUPABASE_POOLER).max).toBe(3);
    vi.stubEnv("DATABASE_POOL_MAX", "5");
    expect(poolConfig(SUPABASE_POOLER).max).toBe(5);
    vi.stubEnv("DATABASE_POOL_MAX", "");
    expect(poolConfig(SUPABASE_POOLER).max).toBe(3);
  });
});
