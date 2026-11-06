-- In its own migration because Postgres cannot use a new enum value in the transaction that adds it.
ALTER TYPE "RoleAccessStatus" ADD VALUE 'REJECTED';
