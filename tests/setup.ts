import { afterAll } from "vitest";
import { disconnectDb } from "@/server/db";

// Runs in every test worker before test files use the Prisma client (it connects lazily).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach_test";

// Close connections cleanly instead of leaving them to be cut when the worker exits.
afterAll(disconnectDb);
