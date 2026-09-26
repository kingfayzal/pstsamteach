// Runs in every test worker before test files import the Prisma client.
process.env.DATABASE_URL = "file:./test.db";
