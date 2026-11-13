import { OrderStatus, Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Cancels an order only if it is still in one of `from`, and only then returns its reserved stock.
 * Returns false if the order has already moved on, for example because the buyer cancelled while
 * the farmer was rejecting it. Checking the status and changing it in one statement means two
 * cancellations at once can't both return the stock.
 *
 * It does not refund. Call refundOrderPayment after the transaction commits, because a Razorpay
 * refund can't be rolled back with it.
 */
export const claimCancellation = async (
  tx: Tx,
  order: { id: string; cropId: string; quantityKg: Prisma.Decimal },
  from: OrderStatus[],
  reason: string,
): Promise<boolean> => {
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: { in: from } },
    data: { status: OrderStatus.CANCELLED, cancellationReason: reason },
  });
  if (claimed.count !== 1) return false;

  await tx.crop.update({
    where: { id: order.cropId },
    data: { quantityRemainingKg: { increment: order.quantityKg } },
  });
  return true;
};

/** What to tell the person who cancelled, depending on how the refund went. */
export const refundMessage = (outcome: string, cancelled: string): string => {
  if (outcome === 'REFUNDED') return `${cancelled} Your full refund has been started.`;
  if (outcome === 'REFUND_FAILED') {
    return `${cancelled} The refund could not be started yet. We will keep retrying it automatically.`;
  }
  return `${cancelled} Stock has been restored.`;
};
