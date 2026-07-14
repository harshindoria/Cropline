import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { Role, OrderStatus, DeliveryType, PaymentType, Prisma, CropStatus, PaymentStatus } from '@prisma/client';
import { calculateDeliveryFee } from '../utils/feeUtils';
import { haversineDistance } from '../utils/geoUtils';
import jwt from 'jsonwebtoken';

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
      include: { 
        catalog: true, 
        offer: true, 
        farmer: { include: { roleAccess: { where: { role: Role.FARMER } } } } 
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
    
    // 💡 FIX 1: Removed the rule that blocks CASH_ON_PICKUP for DELIVERY. 
    // Now CASH_ON_PICKUP acts as generic "Pay at Delivery/Pickup" for both cases.

    const pendingOrdersCount = await prisma.order.count({
      where: { buyerId, status: OrderStatus.PENDING }
    });
    
    if (pendingOrdersCount >= 5) {
      res.status(403).json({ success: false, message: 'You have too many pending orders. Please complete or cancel them first.' });
      return;
    }

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
    const cropMarkupRate = new Prisma.Decimal(process.env.CROP_MARKUP_RATE || '0.05');
    const deliveryCommissionRate = deliveryType === DeliveryType.DELIVERY
      ? new Prisma.Decimal(process.env.DELIVERY_COMMISSION_RATE || '0.20') : new Prisma.Decimal(0);
    
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
      
      return tx.order.create({
        data: {
          cropId,
          farmerId: crop.farmerId,
          buyerId,
          quantityKg: quantity, basePricePerKg: crop.basePricePerKg, farmerEarnings,
          cropMarkupRate, platformFee, deliveryFee, deliveryCommissionRate,
          deliveryPlatformFee, deliveryPartnerPayout, discountAmount, totalBuyerPrice,
          deliveryType,
          paymentType, // Either ONLINE or CASH_ON_PICKUP
          deliveryLatitude,
          deliveryLongitude,
          deliveryAddress,
          status: OrderStatus.PENDING,
          farmerResponseDeadline,
          
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

export const confirmOrder = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { 
        farmer: true,
        crop: true
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

    let nextStatus: OrderStatus = OrderStatus.CONFIRMED;

    if (order.deliveryType === 'DELIVERY') {
      nextStatus = OrderStatus.READY_FOR_PICKUP;
      
      // Find online delivery partners
      const onlineDeliveryBoys = await prisma.user.findMany({
        where: { activeRole: 'DELIVERY', isOnline: true }
      });

      // Filter by 20 KM radius
      const nearbyBoys = onlineDeliveryBoys.filter(boy => {
        if (!boy.latitude || !boy.longitude) return false;
        const dist = haversineDistance(
          order.crop.farmLatitude,
          order.crop.farmLongitude,
          boy.latitude,
          boy.longitude
        );
        return dist <= 20;
      });

      if (nearbyBoys.length > 0) {
        // Create notifications for them
        const notifications = nearbyBoys.map(boy => ({
          userId: boy.id,
          type: 'GENERAL' as const,
          title: 'New delivery request nearby',
          body: `Pickup from ${order.crop.farmVillage || 'nearby location'}`,
          data: { orderId: order.id }
        }));
        await prisma.notification.createMany({ data: notifications });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: nextStatus,
        farmerAcceptedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: order.deliveryType === 'DELIVERY'
        ? 'Order confirmed and broadcasted to nearby delivery partners.' 
        : 'Order confirmed successfully. Please prepare it for pickup/delivery.',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Confirm Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm order' });
  }
};

export const rejectOrder = async (req: Request<{id : string}>, res: Response): Promise<void> => {
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
      if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS) {
        // Here you would ideally call Razorpay Refund API
        // For now, we update the DB to signify refund is initiated
        await tx.paymentRecord.update({
          where: { id: order.paymentRecord.id },
          data: { status: PaymentStatus.REFUNDED } 
        });
      }
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

export const markReady = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Fetch Order
    const order = await prisma.order.findUnique({
      where: { id }
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

    // 4. Update the Status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.READY_FOR_PICKUP }
    });

    // 5. The Notification Hook (Plan 2)
    // TODO: Socket.io Integration
    // Yahan hum io.to(`user:${order.buyerId}`).emit(...) aur nearby delivery partners ko ping karenge
    // jisse app par live notification chali jaye.

    // 6. Success Response
    res.status(200).json({
      success: true,
      message: 'Order marked as ready for pickup. Delivery partners will be notified.',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Mark Ready Error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark order as ready' });
  }
};

export const sendPickupOtp = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Fetch Order with Buyer's phone number
    const order = await prisma.order.findUnique({
      where: { id },
      include: { 
        buyer: { 
          select: { phone: true } 
        } 
      }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 2. The Gatekeeper (Ownership Check)
    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized for this action' });
      return;
    }

    // 3. The State Lock & Rule Check
    if (order.status !== OrderStatus.READY_FOR_PICKUP || order.deliveryType !== DeliveryType.SELF_PICKUP) {
      res.status(400).json({ 
        success: false, 
        message: 'OTP can only be sent for READY_FOR_PICKUP orders with SELF_PICKUP delivery type' 
      });
      return;
    }

    // 4. Generate 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // 5. Save OTP in database
    await prisma.order.update({
      where: { id },
      data: { pickupOtp: generatedOtp }
    });

    // 6. Mock sending SMS (Console log it for testing)
    console.log(`\n=========================================`);
    console.log(`📱 [MOCK SMS] sent to ${order.buyer.phone || 'Buyer'}`);
    console.log(`✉️  "Your KhetSe order OTP is ${generatedOtp}. Share this with the farmer."`);
    console.log(`=========================================\n`);

    // 7. Success Response
    res.status(200).json({ 
      success: true, 
      message: 'OTP sent to buyer successfully' 
    });

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

export const verifyPickupOtp = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    if (!otp) {
      res.status(400).json({ success: false, message: 'OTP is required' });
      return;
    }

    // 1. Fetch Order
    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 2. The Gatekeeper (Ownership Check)
    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to verify this order' });
      return;
    }

    // 3. The State Lock
    if (order.status !== OrderStatus.READY_FOR_PICKUP || order.deliveryType !== DeliveryType.SELF_PICKUP) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid order state for OTP verification' 
      });
      return;
    }
    
    // 4. Match the OTP
    if (order.pickupOtp !== otp) {
      res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
      return;
    }

    // 5. The Magic Trick (Atomic Transaction for Completion)
    const [updatedOrder] = await prisma.$transaction([
      
      // Query 1: Update order status to COMPLETED and clear the OTP
      prisma.order.update({
        where: { id },
        data: { 
          status: OrderStatus.COMPLETED, 
          pickupOtp: null 
        }
      }),

      // Query 2: Increment Farmer's wallet balance
      prisma.user.update({
        where: { id: order.farmerId },
        data: { 
          walletBalance: { increment: order.farmerEarnings } 
        }
      })

    ]);

    // 6. Success Response
    res.status(200).json({ 
      success: true, 
      message: 'Order completed successfully. Earnings credited to your wallet!',
      data: {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        creditedAmount: updatedOrder.farmerEarnings
      }
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};

export const scanQR = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Frontend se QR ka decode hua token nikalna
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'QR Token is required' });
      return;
    }

    // 2. JWT Verify karna (Secret lock kholna)
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.QR_SECRET as string);
    } catch (err) {
      res.status(400).json({ success: false, message: 'Invalid or expired QR code' });
      return;
    }

    // Verify the type field to prevent auth tokens being used as QR
    if (decoded.type !== 'PICKUP_QR') {
      res.status(400).json({ success: false, message: 'Invalid QR code type' });
      return;
    }

    // 3. Token se orderId extract karna
    const orderId = decoded.orderId;

    if (!orderId) {
      res.status(400).json({ success: false, message: 'Invalid QR code payload' });
      return;
    }

    // 4. Order Fetch karna
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Identity verification: ensure the QR belongs to THIS order's buyer
    if (decoded.orderId !== order.id || decoded.buyerId !== order.buyerId) {
      res.status(400).json({ success: false, message: 'QR code does not match this order or buyer' });
      return;
    }

    // 5. The Gatekeeper (Ownership Check)
    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to scan QR for this order' });
      return;
    }

    // 6. The State Lock & Rule Check
    if (order.status !== OrderStatus.READY_FOR_PICKUP || order.deliveryType !== DeliveryType.SELF_PICKUP) {
      res.status(400).json({ 
        success: false, 
        message: 'Order is not ready for pickup or is not a self-pickup order' 
      });
      return;
    }

    // 7. The Magic Trick (Atomic Transaction for Completion)
    const [updatedOrder] = await prisma.$transaction([
      
      // Query 1: Order ko COMPLETED mark karein
      prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED }
      }),

      // Query 2: Kisaan ke virtual wallet mein paise add karein
      prisma.user.update({
        where: { id: order.farmerId },
        data: { walletBalance: { increment: order.farmerEarnings } }
      })

    ]);

    // 8. Success Response
    res.status(200).json({ 
      success: true, 
      message: 'QR verified! Order completed and payment credited to your wallet.',
      data: {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        creditedEarnings: updatedOrder.farmerEarnings
      }
    });

  } catch (error) {
    console.error('Scan QR Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process QR code' });
  }
};

export const getPickupToken = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Fetch the Order
    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 2. The Gatekeeper (Buyer Check)
    if (order.buyerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You are not authorized to view the QR token for this order' });
      return;
    }

    // 3. The State Lock & Rule Check
    if (order.status !== OrderStatus.READY_FOR_PICKUP || order.deliveryType !== DeliveryType.SELF_PICKUP) {
      res.status(400).json({ 
        success: false, 
        message: 'QR code is only available for READY_FOR_PICKUP orders with SELF_PICKUP delivery type' 
      });
      return;
    }

    // 4. Generate the JWT Token (The Digital Ticket)
    // process.env.QR_SECRET hona zaroori hai aapke .env file mein
    const token = jwt.sign(
      { 
        orderId: order.id,
        buyerId: order.buyerId,
        type: 'PICKUP_QR'
      }, 
      process.env.QR_SECRET as string, 
      { expiresIn: '48h' } 
    );

    // 5. Success Response
    res.status(200).json({ 
      success: true, 
      message: 'Pickup token generated successfully',
      data: { token } 
    });

  } catch (error) {
    console.error('Get Pickup Token Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate pickup token' });
  }
};

// ── GET HANDOVER TOKEN (For Farmer's QR Code) ───────────────────────────────
export const getHandoverToken = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Order ID

    // 1. Order fetch karna
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        farmerId: true,
        status: true,
        deliveryType: true,
      }
    });

    if (!order) {
      res.status(404).json({ 
        success: false, 
        message: 'Order not found.' 
      });
      return;
    }

    // 2. Ownership Guard: Sirf order ka kisaan hi token maang sakta hai
    if (order.farmerId !== req.user!.id) {
      res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. You are not the farmer for this order.' 
      });
      return;
    }

    // 3. State Guard: Order ASSIGNED hona zaroori hai tabhi handover hoga
    // (Agar SELF_PICKUP hai toh READY_FOR_PICKUP par buyer ko QR milta hai jo humne pehle hi bana liya tha)
    if (order.deliveryType === 'DELIVERY' && order.status !== OrderStatus.ASSIGNED) {
      res.status(400).json({ 
        success: false, 
        message: `Handover not allowed. Current order status is ${order.status}. Waiting for a delivery partner to be assigned.` 
      });
      return;
    }

    // 4. Secure Token Generation
    const token = jwt.sign(
      { 
        orderId: order.id, 
        farmerId: order.farmerId, 
        type: 'HANDOVER_QR' // Strictly validating this in delivery controller
      },
      process.env.QR_SECRET as string,
      { expiresIn: '1d' } // 24 hours validity
    );

    res.status(200).json({
      success: true,
      message: 'Handover token generated successfully.',
      data: { token }
    });

  } catch (error) {
    console.error('[Order] Get Handover Token Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate handover token.' 
    });
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
        if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS) {
          await tx.paymentRecord.update({
            where: { id: order.paymentRecord.id },
            data: { status: PaymentStatus.REFUNDED }
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
          { farmerId: req.user!.id }
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

export const cancelOrder = async (req: Request<{id: string}>, res: Response): Promise<void> => {
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
      if (order.paymentRecord && order.paymentRecord.status === PaymentStatus.SUCCESS) {
        await tx.paymentRecord.update({
          where: { id: order.paymentRecord.id },
          data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() }
        });
        // TODO: Trigger actual Razorpay refund API
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
