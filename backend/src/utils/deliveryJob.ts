import { DeliveryJobStatus, Prisma } from '@prisma/client';

// An order keeps its cancelled jobs as history, and has at most one job that is not cancelled.
export const ACTIVE_JOB = { status: { not: DeliveryJobStatus.CANCELLED } } satisfies Prisma.DeliveryJobWhereInput;

type WithJobs = { deliveryJobs: unknown[] };

// The API and the screens work with one current job, so this turns the fetched list back into that.
export const withCurrentJob = <T extends WithJobs>(order: T) => {
  const { deliveryJobs, ...rest } = order;
  return { ...rest, deliveryJob: (deliveryJobs[0] ?? null) as T['deliveryJobs'][number] | null };
};

export const withOrderCurrentJob = <O extends WithJobs, T extends { order: O | null }>(row: T) => ({
  ...row,
  order: row.order && withCurrentJob(row.order),
});
