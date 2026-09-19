import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { Role, OrderStatus, DeliveryType, PaymentType, Prisma, CropStatus, PaymentStatus, VerificationPurpose, VerificationTokenType, DeliveryOfferStatus, DeliveryJobStatus } from '@prisma/client';
import { calculateDeliveryFee } from '../utils/feeUtils';
import { haversineDistance } from '../utils/geoUtils';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { assignDeliveryJob, assignDeliveryJobByPincode } from '../services/deliveryAssignment.service';
import { issueRazorpayRefund } from '../services/payment.service';

// ── ZOD SCHEMA ──────────────────────────────────────────────────────────────
const createOrderSchema = z.object({
  cropId: z.string().min(1, "Crop ID is required"),
  quantityKg: z.coerce.number().positive("Quantity must be positive"),
  deliveryType: z.nativeEnum(DeliveryType),
  paymentType: z.nativeEnum(PaymentType),
  deliveryLatitude: z.coerce.number().optional(),
  deliveryLongitude: z.coerce.number().optional(),
  deliveryAddress: z.string().optional(),
});

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues
      });
      return;
    }

    const { cropId, quantityKg, deliveryType, paymentType, deliveryLatitude, deliveryLongitude, deliveryAddress } = parsed.data;
    const buyerId = req.user!.id;

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: {
        id: true,
        farmerId: true,
        status: true,
        isPreHarvest: true,
        basePricePerKg: true,
        quantityRemainingKg: true,
        minOrderKg: true,
        farmLatitude: true,
        farmLongitude: true,
        offer: {
          select: {
            minQuantityKg: true,
            discountPercentage: true,
          },
        },
        farmer: {
          select: {
            roleAccess: {
              where: { role: Role.FARMER },
              select: {
                status: true,
                blockedUntil: true,
              },
            },
          },
        },
      },
    });

    if (!crop) {
      res.status(404).json({ success: false, message: 'Crop not found' });
      return;
    }

    if (crop.status !== CropStatus.ACTIVE || crop.isPreHarvest) {
      res.status(400).json({ success: false, message: 'This crop is not currently active for sale' });
      return;
    }

    const farmerAccess = crop.farmer.roleAccess[0];
    const farmerBlocked = farmerAccess?.status === 'BLOCKED' && (!farmerAccess.blockedUntil || farmerAccess.blockedUntil > new Date());

    if (!farmerAccess || farmerBlocked) {
      res.status(409).json({ success: false, code: 'FARMER_UNAVAILABLE', message: 'This farmer is not accepting new orders.' });
      return;
    }

    if (crop.farmerId === buyerId) {
      res.status(403).json({ success: false, message: 'You cannot buy your own crop' });
      return;
    }

    if (quantityKg < Number(crop.minOrderKg)) {
      res.status(400).json({ success: false, message: `Minimum order quantity is ${crop.minOrderKg} kg` });
      return;
    }

    if (quantityKg > Number(crop.quantityRemainingKg)) {
      res.status(400).json({ success: false, message: `Only ${crop.quantityRemainingKg} kg remaining in stock` });
      return;
    }

    if (deliveryType === DeliveryType.SELF_PICKUP && process.env.SELF_PICKUP_ENABLED !== 'true') {
      res.status(409).json({ success: false, code: 'SELF_PICKUP_DISABLED', message: 'Self pickup is currently unavailable.' });
      return;
    }

    if (deliveryType === DeliveryType.DELIVERY && (!deliveryLatitude || !deliveryLongitude || !deliveryAddress)) {
      res.status(400).json({ success: false, message: 'Delivery coordinates and address are required for delivery' });
      return;
    }

    const pendingOrdersCount = await prisma.order.count({
      where: { buyerId, status: OrderStatus.PENDING }
    });

    if (pendingOrdersCount >= 5) {
      res.status(403).json({ success: false, message: 'You have too many pending orders. Please complete or cancel them first.' });
      return;
    }

    const platformSettings = await prisma.platformSettings.findFirst();
    const cropMarkupRate = platformSettings ? platformSettings.cropMarkupRate : new Prisma.Decimal('0.20');
    const deliveryCommissionRate = platformSettings ? platformSettings.deliveryMarkupRate : new Prisma.Decimal('0.20');

    let deliveryFee = new Prisma.Decimal(0);
    if (deliveryType === DeliveryType.DELIVERY) {
      const distanceKm = haversineDistance(
        crop.farmLatitude, crop.farmLongitude,
        deliveryLatitude!, deliveryLongitude!
      );
      deliveryFee = new Prisma.Decimal(calculateDeliveryFee(distanceKm, quantityKg)).toDecimalPlaces(2);
    }

    let discountAmount = new Prisma.Decimal(0);
    const quantity = new Prisma.Decimal(quantityKg);
    const baseTotal = crop.basePricePerKg.mul(quantity);

    if (crop.offer && quantityKg >= Number(crop.offer.minQuantityKg)) {
      discountAmount = baseTotal.mul(crop.offer.discountPercentage.div(100)).toDecimalPlaces(2);
    }

    const farmerEarnings = baseTotal.minus(discountAmount).toDecimalPlaces(2);

    const platformFee = farmerEarnings.mul(cropMarkupRate).toDecimalPlaces(2);
    const deliveryPlatformFee = deliveryFee.mul(deliveryCommissionRate).toDecimalPlaces(2);
    const deliveryPartnerPayout = deliveryFee.minus(deliveryPlatformFee);
    const totalBuyerPrice = farmerEarnings.plus(platformFee).plus(deliveryFee).toDecimalPlaces(2);
    const farmerResponseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newOrder = await prisma.$transaction(async tx => {
      const reserved = await tx.crop.updateMany({
        where: { id: cropId, status: CropStatus.ACTIVE, isPreHarvest: false, quantityRemainingKg: { gte: quantity } },
        data: { quantityRemainingKg: { decrement: quantity } },
      });

      if (reserved.count !== 1) throw new Error('INSUFFICIENT_STOCK');

      const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

      return tx.order.create({
        data: {
          cropId,
          farmerId: crop.farmerId,
          buyerId,
          quantityKg: quantity, basePricePerKg: crop.basePricePerKg, farmerEarnings,
          cropMarkupRate, platformFee, deliveryFee, deliveryCommissionRate,
          deliveryPlatformFee, deliveryPartnerPayout, discountAmount, totalBuyerPrice,
          deliveryType,
          paymentType,
          deliveryLatitude,
          deliveryLongitude,
          deliveryAddress,
          status: OrderStatus.PENDING,
          farmerResponseDeadline,
          pickupOtp,
          deliveryOtp,

          // 💡 FIX 2: Provider will be 'RAZORPAY' or 'CASH_COD'. Status defaults to PENDING.
          paymentRecord: {
            create: {
              provider: paymentType === PaymentType.ONLINE ? 'RAZORPAY' : 'CASH_COD',
              amount: totalBuyerPrice
            }
          },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: newOrder
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      res.status(409).json({ success: false, code: 'INSUFFICIENT_STOCK', message: 'The requested stock is no longer available.' });
      return;
    }
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
};

export const confirmOrder = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        farmer: true,
        crop: true,
        paymentRecord: true
      }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to confirm this order' });
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: `Cannot confirm order. Current status is ${order.status}`
      });
      return;
    }

    // Ensure farmer cannot confirm an unpaid ONLINE order
    if (order.paymentType === 'ONLINE' && order.paymentRecord?.status !== 'SUCCESS') {
      res.status(400).json({
        success: false,
        message: 'Cannot confirm order. The buyer has not completed the online payment yet.'
      });
      return;
    }

    let updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CONFIRMED,
        farmerAcceptedAt: new Date()
      },
      include: { crop: { include: { catalog: true } } }
    });

    let assignedPartner = null;
    if (updatedOrder.deliveryType === DeliveryType.DELIVERY) {
      assignedPartner = await assignDeliveryJobByPincode(id);
      if (assignedPartner) {
        updatedOrder.status = OrderStatus.ASSIGNED;
      }
    }

    // Notify the buyer
    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: 'Order Confirmed! ✅',
        body: `The farmer has accepted your order for ${updatedOrder.crop?.catalog?.englishName || 'crops'}. They will prepare it shortly.`,
        data: { orderId: id }
      }
    });

    res.status(200).json({
      success: true,
      message: assignedPartner 
        ? `Order confirmed and delivery assigned to ${assignedPartner.name || 'a partner'}.` 
        : 'Order confirmed successfully. Mark the crop ready when it is prepared.',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Confirm Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm order' });
  }
};

export const rejectOrder = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { paymentRecord: true } // 💡 FIX 3: Fetch payment record to check if refund is needed
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to reject this order' });
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: `Cannot reject order. Current status is ${order.status}`
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore the crop stock
      await tx.crop.update({
        where: { id: order.cropId },
        data: { quantityRemainingKg: { increment: order.quantityKg } }
      });

      // 2. Mark Order as Cancelled
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancellationReason: reason || 'Cancelled by farmer'
        }
      });

      // 3. 💡 FIX 3: Handle Refund Scenario for Pre-paid Orders
      if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS && order.paymentRecord.providerPaymentId) {
        // Call Razorpay Refund API
        await issueRazorpayRefund(order.paymentRecord.providerPaymentId, undefined, { reason: 'Order rejected by farmer' });
        
        await tx.paymentRecord.update({
          where: { id: order.paymentRecord.id },
          data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() }
        });
      }
      
      // 4. Notify the buyer about the rejection
      await tx.notification.create({
        data: {
          userId: order.buyerId,
          title: 'Order Rejected ❌',
          body: reason ? `The farmer rejected your order: ${reason}` : 'The farmer has rejected your order.',
          data: { orderId: id }
        }
      });
    });

    res.status(200).json({
      success: true,
      message: 'Order rejected. Stock has been restored successfully.',
    });

  } catch (error) {
    console.error('Reject Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject order' });
  }
};

export const markReady = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Fetch Order
    const order = await prisma.order.findUnique({
      where: { id },
      include: { crop: { select: { farmLatitude: true, farmLongitude: true } } },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 2. The Gatekeeper (Ownership Check)
    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to modify this order' });
      return;
    }

    // 3. The State Lock (Strictly CONFIRMED only)
    if (order.status !== OrderStatus.CONFIRMED) {
      res.status(400).json({
        success: false,
        message: `Cannot mark as ready. Current status is ${order.status}`
      });
      return;
    }

    let updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.READY_FOR_PICKUP },
    });

    let assignedPartner = null;
    if (order.deliveryType === DeliveryType.DELIVERY) {
       assignedPartner = await assignDeliveryJob(id);
       
       if (!assignedPartner) {
         // No partner found! Update state to DELIVERY_SEARCHING
         updatedOrder = await prisma.order.update({
           where: { id },
           data: { status: OrderStatus.DELIVERY_SEARCHING }
         });

         // Notify Farmer
         await prisma.notification.create({
           data: {
             userId: order.farmerId,
             title: 'Delivery Delayed 🚚',
             body: 'No suitable delivery partner found right now. We will keep trying every 2 hours.',
             data: { orderId: id }
           }
         });

         // Notify Buyer
         await prisma.notification.create({
           data: {
             userId: order.buyerId,
             title: 'Delivery Delayed 🚚',
             body: 'Your farmer is ready, but no suitable delivery partner was found nearby. We will keep trying every 2 hours.',
             data: { orderId: id }
           }
         });
       }
    }

    // 6. Success Response
    res.status(200).json({
      success: true,
      message: assignedPartner
        ? `Order marked ready. Delivery assigned to ${assignedPartner.name || 'a partner'} (${assignedPartner.vehicleType}).`
        : (order.deliveryType === DeliveryType.DELIVERY 
            ? 'Order marked ready. No delivery partner found, scheduled for automatic retry.' 
            : 'Order marked ready for self-pickup.'),
      data: updatedOrder
    });

  } catch (error) {
    console.error('Mark Ready Error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark order as ready' });
  }
};

const autoRejectExpiredOrders = async () => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: sixHoursAgo }
      },
      include: { paymentRecord: true }
    });

    if (expiredOrders.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const order of expiredOrders) {
        // Restore stock
        await tx.crop.update({
          where: { id: order.cropId },
          data: { quantityRemainingKg: { increment: order.quantityKg } }
        });
        // Cancel order
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancellationReason: 'Auto-rejected after 6 hours without farmer acceptance'
          }
        });
        // Process refund DB state
        if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS && order.paymentRecord.providerPaymentId) {
          await issueRazorpayRefund(order.paymentRecord.providerPaymentId, undefined, { reason: 'Order auto-rejected (timeout)' });
          await tx.paymentRecord.update({
            where: { id: order.paymentRecord.id },
            data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() }
          });
        }
      }
    });
  } catch (error) {
    console.error("Auto-reject error:", error);
  }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    await autoRejectExpiredOrders();
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { buyerId: req.user!.id },
          { 
            farmerId: req.user!.id,
            NOT: {
              status: OrderStatus.PENDING,
              paymentType: PaymentType.ONLINE,
              paymentRecord: {
                status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] }
              }
            }
          }
        ]
      },
      include: {
        crop: { include: { catalog: true } },
        farmer: { select: { id: true, name: true, village: true, district: true, rating: true, ratingCount: true, isVerified: true } },
        buyer: { select: { id: true, name: true, village: true, district: true } },
        paymentRecord: true,
        deliveryJob: { include: { deliveryPartner: { select: { id: true, name: true, phone: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    await autoRejectExpiredOrders();
    const order = await prisma.order.findUnique({
      where: { id: req.params.id as string },
      include: {
        crop: { include: { catalog: true } },
        buyer: { select: { id: true, name: true, email: true, phone: true, village: true, district: true, state: true, pincode: true } },
        farmer: { select: { id: true, name: true, email: true, phone: true, village: true, district: true, state: true, rating: true, ratingCount: true, isVerified: true } },
        paymentRecord: true,
        deliveryJob: { include: { deliveryPartner: { select: { id: true, name: true, phone: true, vehicleType: true } } } }
      }
    });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    // Access control: only buyer or farmer can view
    if (order.buyerId !== req.user!.id && order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
};

export const cancelOrder = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { paymentRecord: true }
    });
    if (!order || order.buyerId !== req.user!.id) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({ success: false, message: 'Cannot cancel order at this stage' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore reserved stock
      await tx.crop.update({
        where: { id: order.cropId },
        data: { quantityRemainingKg: { increment: order.quantityKg } }
      });

      // 2. Cancel the order
      await tx.order.update({
        where: { id: req.params.id },
        data: { status: OrderStatus.CANCELLED, cancellationReason: 'Buyer cancelled' }
      });

      // 3. If payment was captured, mark for refund
      if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS && order.paymentRecord.providerPaymentId) {
        await issueRazorpayRefund(order.paymentRecord.providerPaymentId, undefined, { reason: 'Order cancelled by buyer' });
        await tx.paymentRecord.update({
          where: { id: order.paymentRecord.id },
          data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() }
        });
      }
    });

    res.json({ success: true, message: 'Order cancelled and stock restored' });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
};

export const unbanPayment = async (req: Request, res: Response): Promise<void> => {
  // Logic to generate razorpay link for 1000 INR
  res.json({ success: true, paymentLink: "https://razorpay.me/.../mocklink" });
};
