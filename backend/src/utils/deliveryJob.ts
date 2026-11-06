import { DeliveryJobStatus, Prisma } from '@prisma/client';

// An order keeps its cancelled jobs as history, and has at most one job that is not cancelled.
export const ACTIVE_JOB = { status: { not: DeliveryJobStatus.CANCELLED } } satisfies Prisma.DeliveryJobWhereInput;

type WithJobs<J> = { deliveryJobs: J[] };

// The API and the screens work with one current job, so this turns the fetched list back into that.
export const withCurrentJob = <J, T extends WithJobs<J>>(order: T) => {
  const { deliveryJobs, ...rest } = order;
  return { ...rest, deliveryJob: deliveryJobs[0] ?? null };
};

export const withOrderCurrentJob = <J, O extends WithJobs<J>, T extends { order: O | null }>(row: T) => ({
  ...row,
  order: row.order && withCurrentJob<J, O>(row.order),
});
