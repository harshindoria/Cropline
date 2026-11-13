import { Request, Response } from 'express';
import { prisma } from '../config/db';
import {
  verifyRazorpayWebhookSignature,
  verifyRazorpayCheckoutSignature,
  createRazorpayPaymentLink,
  createRazorpayOrder
} from '../services/payment.service';
import crypto from 'crypto';
import { applySettlementPayment } from '../services/cashSettlement.service';
import { applyProcessedRefund, markPaymentFailed, markPaymentSucceeded } from '../services/paymentRecord.service';
import { OrderStatus } from '@prisma/client';

// Orders that are finished one way or another, so no new payment may start for them.
const CLOSED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.DISPUTED,
];

// ============================================================================
// 1. THE MASTER SWITCHBOARD (Webhook Listener)
// ============================================================================
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!secret) console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not set, so every webhook is rejected.');

    const rawBody = req.rawBody;

    if (!rawBody || !verifyRazorpayWebhookSignature(rawBody, signature, secret)) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Webhook Received] Event: ${event}`);

    switch (event) {
      // ---------------------------------------------------------
      // A. THE BUYER CHECKOUT LOOP
      // ---------------------------------------------------------
      case 'payment.captured':
      case 'order.paid': {
        const paymentEntity = payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        await markPaymentSucceeded(razorpayOrderId, paymentEntity.id);
        break;
      }

      case 'payment.failed': {
        const paymentEntity = payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        await markPaymentFailed(razorpayOrderId, paymentEntity.id, paymentEntity.error_description);
        console.log(`Payment failed for Order ID: ${razorpayOrderId}`);
        break;
      }

      // ---------------------------------------------------------
      // B. THE DRIVER SETTLEMENT LOOP
      // ---------------------------------------------------------
      case 'payment_link.paid': {
        const linkEntity = payload.payment_link.entity;
        const notes = linkEntity.notes || {};
        const paymentId = payload.payment?.entity?.id;
        if (!paymentId) throw new Error('payment_link.paid webhook has no payment');

        // Settles what the link was for, and refunds any part of the payment that settled nothing.
        await applySettlementPayment({
          paymentId,
          // Links made before settlement links had their own reference used the partner's ID as it.
          driverId: notes.driverId ?? linkEntity.reference_id,
          liabilityId: notes.liabilityId || 'ALL',
          amountPaidPaise: Number(linkEntity.amount_paid),
          linkCreatedAt: linkEntity.created_at ? new Date(Number(linkEntity.created_at) * 1000) : undefined,
        });
        break;
      }

      case 'payment_link.expired':
      case 'payment_link.cancelled': {
        console.log(`Payment link for reference ${payload.payment_link.entity.reference_id} expired/cancelled.`);
        break;
      }

      // ---------------------------------------------------------
      // C. THE REFUND LOOP
      // ---------------------------------------------------------
      case 'refund.processed': {
        await applyProcessedRefund(payload.refund.entity);
        break;
      }

      // ---------------------------------------------------------
      // D. THE ENTERPRISE GUARDRAILS
      // ---------------------------------------------------------
      case 'payment.dispute.created': {
        const disputeEntity = payload.dispute.entity;
        const paymentId = disputeEntity.payment_id;

        const paymentRecord = await prisma.paymentRecord.findFirst({
          where: { providerPaymentId: paymentId }
        });

        if (paymentRecord && paymentRecord.orderId) {
          await prisma.order.update({
            where: { id: paymentRecord.orderId },
            data: { status: 'DISPUTED' }
          });
        }
        break;
      }

      case 'settlement.processed': {
        console.log('Bank settlement received from Razorpay.');
        break;
      }

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// ============================================================================
// 2. CREATE DRIVER SETTLEMENT LINK 
// ============================================================================
export const createDriverSettlementLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user; 
    if (!user || user.activeRole !== 'DELIVERY') {
      res.status(403).json({ success: false, message: 'Only delivery partners can initiate settlement.' });
      return;
    }

    const { liabilityId } = req.body;
    let amountDue = 0;

    if (liabilityId) {
      // Settle a specific liability
      const liability = await prisma.cashLiability.findUnique({
        where: { id: liabilityId }
      });
      if (!liability || liability.deliveryPartnerId !== user.id || liability.reconciledAt) {
        res.status(400).json({ success: false, message: 'Invalid or already settled liability.' });
        return;
      }
      amountDue = Number(liability.amount);
    } else {
      // Settle all at once
      const liabilityData = await prisma.cashLiability.aggregate({
        _sum: { amount: true },
        where: { deliveryPartnerId: user.id, reconciledAt: null }
      });
      amountDue = Number(liabilityData._sum.amount || 0);
    }

    if (amountDue <= 0) {
      res.status(400).json({ success: false, message: 'No pending liability to settle.' });
      return;
    }

    const driverDetails = {
      name: user.name || 'Delivery Partner',
      contact: user.phone || '',
      email: user.email || ''
    };

    // Razorpay needs a reference_id that is unique for every payment link, so it can't be the
    // partner's ID: their second link would be refused. The partner and what to settle travel in
    // the notes, which Razorpay sends back in the webhook.
    const referenceId = `settle_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const linkResponse = await createRazorpayPaymentLink(amountDue, referenceId, driverDetails, {
      liabilityId: liabilityId || 'ALL',
      driverId: user.id,
    });

    res.status(200).json({
      success: true,
      data: {
        paymentUrl: linkResponse.short_url,
        linkId: linkResponse.id,
        amount: amountDue
      }
    });
  } catch (error) {
    console.error('Error generating settlement link:', error);
    res.status(500).json({ success: false, message: 'Failed to generate settlement link.' });
  }
};


// ============================================================================
// 3. GET DRIVER OUTSTANDING SUMMARY 
// ============================================================================
export const getDriverOutstandingSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
       res.status(401).json({ success: false, message: 'Unauthorized' });
       return;
    }

    const [liabilitySum, liabilityCount, liabilities] = await prisma.$transaction([
      prisma.cashLiability.aggregate({
        _sum: { amount: true },
        where: { deliveryPartnerId: user.id, reconciledAt: null }
      }),
      prisma.cashLiability.count({
        where: { deliveryPartnerId: user.id, reconciledAt: null }
      }),
      prisma.cashLiability.findMany({
        where: { deliveryPartnerId: user.id, reconciledAt: null },
        include: {
          order: {
            include: {
              crop: { include: { catalog: true } },
              buyer: { select: { id: true, name: true, phone: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPendingAmount: Number(liabilitySum._sum.amount || 0),
        totalPendingOrders: liabilityCount,
        liabilities: liabilities
      }
    });
  } catch (error) {
    console.error('Error fetching driver summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch summary.' });
  }
};


// ============================================================================
// 4. INITIATE ORDER PAYMENT 
// ============================================================================
export const verifyOrderPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.orderId as string;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

    if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string') {
      res.status(400).json({ success: false, message: 'Payment details are missing.' });
      return;
    }

    // The payment must be for this order, and the order must be this buyer's.
    const record = await prisma.paymentRecord.findUnique({
      where: { orderId },
      select: { providerOrderId: true, order: { select: { buyerId: true } } },
    });
    if (!record || record.order.buyerId !== req.user!.id) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    if (record.providerOrderId !== razorpay_order_id) {
      res.status(400).json({ success: false, message: 'This payment does not belong to this order.' });
      return;
    }

    if (!verifyRazorpayCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
      return;
    }

    const outcome = await markPaymentSucceeded(razorpay_order_id, razorpay_payment_id);

    if (outcome === 'REFUNDED_CANCELLED_ORDER') {
      res.status(409).json({
        success: false,
        code: 'ORDER_CANCELLED_REFUNDED',
        message: 'This order was cancelled before your payment arrived, so your payment has been refunded in full.',
      });
      return;
    }

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

export const initiateOrderPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId as string },
      include: { paymentRecord: true }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.buyerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Allowed converting COD to ONLINE at the door as requested

    // A closed order can't take money. Without this, a buyer could pay for a cancelled order.
    if (CLOSED_ORDER_STATUSES.includes(order.status)) {
      res.status(409).json({
        success: false,
        code: 'ORDER_CLOSED',
        message: `This order is ${order.status.toLowerCase()}, so it can't be paid for.`,
      });
      return;
    }

    // If payment already completed
    if (order.paymentRecord?.status === 'SUCCESS') {
      res.status(400).json({ success: false, message: 'Payment already completed' });
      return;
    }

    // A refunded payment's Razorpay order is finished, so it can't be reused for a new payment.
    if (order.paymentRecord?.status === 'REFUNDED') {
      res.status(409).json({ success: false, code: 'PAYMENT_REFUNDED', message: 'The payment for this order was refunded.' });
      return;
    }

    // If we already have a Razorpay order ID that hasn't been paid, reuse it
    if (order.paymentRecord?.providerOrderId) {
      res.status(200).json({
        success: true,
        data: {
          providerOrderId: order.paymentRecord.providerOrderId,
          paymentRecordId: order.paymentRecord.id,
          amount: Number(order.totalBuyerPrice) * 100, // paise
          currency: 'INR',
          orderId: order.id
        }
      });
      return;
    }

    const amountInRupees = Number(order.totalBuyerPrice);
    const receiptId = `receipt_${orderId}`;
    const razorpayOrder = await createRazorpayOrder(amountInRupees, receiptId, {
      orderId: order.id,
      buyerId: order.buyerId
    });

    // Update the existing payment record with the Razorpay order ID
    if (order.paymentRecord) {
      await prisma.paymentRecord.update({
        where: { id: order.paymentRecord.id },
        data: { providerOrderId: razorpayOrder.id }
      });
    } else {
      // Fallback: create if somehow missing
      await prisma.paymentRecord.create({
        data: {
          orderId: order.id,
          provider: 'RAZORPAY',
          providerOrderId: razorpayOrder.id,
          amount: amountInRupees,
          status: 'PENDING'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        providerOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount, // in paise
        currency: razorpayOrder.currency,
        orderId: order.id
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate payment.' });
  }
};