import { Request, Response } from 'express';
import { prisma } from '../config/db'; 
import { 
  verifyRazorpayWebhookSignature, 
  createRazorpayPaymentLink, 
  createRazorpayOrder 
} from '../services/payment.service';

// ============================================================================
// 1. THE MASTER SWITCHBOARD (Webhook Listener)
// ============================================================================
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    const rawBody = (req as any).rawBody; 

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

        await prisma.paymentRecord.updateMany({
          where: { providerOrderId: razorpayOrderId },
          data: { 
            status: 'SUCCESS', // Exactly matches PaymentStatus Enum
            providerPaymentId: paymentEntity.id,
            capturedAt: new Date() // Aapke schema ke mutabiq precise date
          }
        });
        break;
      }

      case 'payment.failed': {
        const paymentEntity = payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        
        await prisma.paymentRecord.updateMany({
          where: { providerOrderId: razorpayOrderId },
          data: { status: 'FAILED' }
        });
        console.log(`Payment failed for Order ID: ${razorpayOrderId}`);
        break;
      }

      // ---------------------------------------------------------
      // B. THE DRIVER SETTLEMENT LOOP
      // ---------------------------------------------------------
      case 'payment_link.paid': {
        const linkEntity = payload.payment_link.entity;
        const driverId = linkEntity.reference_id; 

        await prisma.$transaction(async (tx) => {
          const liabilities = await tx.cashLiability.findMany({
            where: { deliveryPartnerId: driverId, reconciledAt: null }
          });

          if (liabilities.length > 0) {
            await tx.cashLiability.updateMany({
              where: { deliveryPartnerId: driverId, reconciledAt: null },
              data: { reconciledAt: new Date() }
            });
          }
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
        const refundEntity = payload.refund.entity;
        const paymentId = refundEntity.payment_id;

        await prisma.paymentRecord.updateMany({
          where: { providerPaymentId: paymentId },
          data: { 
            status: 'REFUNDED', 
            refundedAt: new Date() 
          }
        });
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

    const liabilityData = await prisma.cashLiability.aggregate({
      _sum: { amount: true },
      where: { deliveryPartnerId: user.id, reconciledAt: null }
    });

    const amountDue = Number(liabilityData._sum.amount || 0);

    if (amountDue <= 0) {
      res.status(400).json({ success: false, message: 'No pending liability to settle.' });
      return;
    }

    const driverDetails = {
      name: user.name || 'Delivery Partner',
      contact: user.phone || '',
      email: user.email || ''
    };

    const linkResponse = await createRazorpayPaymentLink(amountDue, user.id, driverDetails);

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

    const [liabilitySum, liabilityCount] = await prisma.$transaction([
      prisma.cashLiability.aggregate({
        _sum: { amount: true },
        where: { deliveryPartnerId: user.id, reconciledAt: null }
      }),
      prisma.cashLiability.count({
        where: { deliveryPartnerId: user.id, reconciledAt: null }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPendingAmount: Number(liabilitySum._sum.amount || 0),
        totalPendingOrders: liabilityCount
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

    if (order.paymentType !== 'ONLINE') {
      res.status(400).json({ success: false, message: 'This order uses Cash on Delivery' });
      return;
    }

    // If payment already completed
    if (order.paymentRecord?.status === 'SUCCESS') {
      res.status(400).json({ success: false, message: 'Payment already completed' });
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