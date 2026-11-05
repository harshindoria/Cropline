import { execSync } from 'node:child_process';

// Runs once before the suite: brings the test database up to date using the real migrations.
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
