import prisma from '../config/db';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { assignDeliveryJob } from './deliveryAssignment.service';

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
      console.log(`[CRON] Retrying delivery assignment for order: ${order.id}`);
      
      const assignedPartner = await assignDeliveryJob(order.id);

      if (assignedPartner) {
        console.log(`[CRON] Success! Assigned order ${order.id} to partner ${assignedPartner.id}`);
      } else {
        // Ultimate Failure: It's been 2 hours and we STILL can't find a delivery guy.
        // We must cancel the order.
        console.log(`[CRON] Failed again for order ${order.id}. Cancelling order...`);
        
        await prisma.$transaction(async (tx) => {
          // 1. Cancel the order
          await tx.order.update({
            where: { id: order.id },
            data: { 
              status: OrderStatus.CANCELLED,
              cancellationReason: 'No delivery partner could be found within the time limit.'
            }
          });

          // 2. Restore stock
          await tx.crop.update({
            where: { id: order.cropId },
            data: { quantityRemainingKg: { increment: order.quantityKg } }
          });

          // 3. Initiate Refund if pre-paid
          if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS) {
            await tx.paymentRecord.update({
              where: { id: order.paymentRecord.id },
              data: { status: PaymentStatus.REFUNDED }
            });
          }

          // 4. Notify Farmer
          await tx.notification.create({
            data: {
              userId: order.farmerId,
              title: 'Order Cancelled 🚫',
              body: 'Unfortunately, we could not find a delivery partner after 2 hours. The order has been cancelled and stock restored.',
              data: { orderId: order.id }
            }
          });

          // 5. Notify Buyer
          await tx.notification.create({
            data: {
              userId: order.buyerId,
              title: 'Order Cancelled & Refunded 🚫',
              body: 'Unfortunately, we could not find a delivery partner to deliver your order. The order has been cancelled. If you paid online, your refund has been initiated.',
              data: { orderId: order.id }
            }
          });
        });
      }
    } catch (error) {
      console.error(`[CRON] Error processing order ${order.id}:`, error);
    }
  }
}

export function startCronJobs() {
    // Run every 10 minutes to check if any order has crossed the 2-hour threshold
    setInterval(() => {
        processRetryDeliveryAssignments().catch(console.error);
    }, 10 * 60 * 1000);
}
