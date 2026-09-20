import prisma from '../config/db';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { retryBroadcastWithExpandedRadius } from './deliveryAssignment.service';

export async function processRetryDeliveryAssignments() {
  console.log('[CRON] Running Delivery Assignment Retry...');
  
  // Find orders that have been waiting for > 2 hours in DELIVERY_SEARCHING state
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const waitingOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.DELIVERY_SEARCHING,
      updatedAt: { lte: twoHoursAgo }
    },
    include: { paymentRecord: true }
  });

  for (const order of waitingOrders) {
    try {
      console.log(`[CRON] Retrying broadcast for order: ${order.id}`);
      await retryBroadcastWithExpandedRadius(order.id);
    } catch (error) {
      console.error(`[CRON] Error processing order ${order.id}:`, error);
    }
  }

  // Ultimate Failure: Orders in DELIVERY_SEARCHING for > 4 hours with zero active offers
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const abandonedOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.DELIVERY_SEARCHING,
      updatedAt: { lte: fourHoursAgo },
      deliveryOffers: { none: { status: 'OFFERED' } } // Zero active offers left
    },
    include: { paymentRecord: true }
  });

  for (const order of abandonedOrders) {
    try {
      console.log(`[CRON] No driver found in 4hrs for order ${order.id}. Cancelling...`);
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancellationReason: 'No delivery partner could be found within the time limit.'
          }
        });
        await tx.crop.update({
          where: { id: order.cropId },
          data: { quantityRemainingKg: { increment: order.quantityKg } }
        });
        if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS) {
          await tx.paymentRecord.update({
            where: { id: order.paymentRecord.id },
            data: { status: PaymentStatus.REFUNDED }
          });
        }
        await tx.notification.create({
          data: {
            userId: order.farmerId,
            title: 'Order Cancelled 🚫',
            body: 'No delivery partner was found after multiple attempts. Order cancelled & stock restored.',
            data: { orderId: order.id }
          }
        });
        await tx.notification.create({
          data: {
            userId: order.buyerId,
            title: 'Order Cancelled & Refunded 🚫',
            body: 'No delivery partner was found. Order cancelled. If you paid online, your refund has been initiated.',
            data: { orderId: order.id }
          }
        });
      });
    } catch (error) {
      console.error(`[CRON] Error cancelling order ${order.id}:`, error);
    }
  }
}

export function startCronJobs() {
    // Run every 10 minutes to check if any order has crossed the 2-hour threshold
    setInterval(() => {
        processRetryDeliveryAssignments().catch(console.error);
    }, 10 * 60 * 1000);
}
