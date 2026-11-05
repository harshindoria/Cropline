import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Integration tests wipe every table between cases, so they only ever run against
// TEST_DATABASE_URL. There is deliberately no fallback to DATABASE_URL.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set. Point it at a dedicated database whose name ends in "_test".');
}

const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against "${databaseName}": the database name must end in "_test".`);
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: 'tests/globalSetup.ts',
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    silent: 'passed-only',
  },
});
