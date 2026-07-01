import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { Role, OrderStatus, DeliveryType, PaymentType, Prisma, CropStatus } from '@prisma/client';
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

    // 💡 UPDATE: Included 'catalog' and 'offer' relations
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
      res.status(409).json({ success: false, code: 'FARMER_UNAVAILABLE', message: 'This farmer is not accepting new orders.' }); return;
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
      res.status(409).json({ success: false, code: 'SELF_PICKUP_DISABLED', message: 'Self pickup is currently unavailable.' }); return;
    }
    if (deliveryType === DeliveryType.DELIVERY && (!deliveryLatitude || !deliveryLongitude || !deliveryAddress)) {
      res.status(400).json({ success: false, message: 'Delivery coordinates and address are required for delivery' });
      return;
    }
    
    if (paymentType === PaymentType.CASH_ON_PICKUP && deliveryType === DeliveryType.DELIVERY) {
      res.status(400).json({ success: false, message: 'Cash on pickup is only available for self-pickup orders' });
      return;
    }

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

    // 💡 UPDATE: Apply Bulk Discount logic
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
          deliveryPlatformFee, deliveryPartnerPayout, discountAmount, totalBuyerPrice, // 💡 Updated with discountAmount
          deliveryType,
          paymentType,
          deliveryLatitude,
          deliveryLongitude,
          deliveryAddress,
          status: OrderStatus.PENDING,
          farmerResponseDeadline,
          paymentRecord: { create: { provider: paymentType === PaymentType.ONLINE ? 'RAZORPAY' : 'CASH', amount: totalBuyerPrice } },
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
      res.status(409).json({ success: false, code: 'INSUFFICIENT_STOCK', message: 'The requested stock is no longer available.' }); return;
    }
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page, limit } = req.query;

    // 1. Pagination Math
    const pageNum  = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Number(limit) || 10, 50);
    const skip     = (pageNum - 1) * limitNum;

    // 2. The Smart Filter (Role ke hisaab se)
    const where: Prisma.OrderWhereInput = {};
    
    if (req.user!.activeRole === Role.BUYER) {
      where.buyerId = req.user!.id;
    } else if (req.user!.activeRole === Role.FARMER) {
      where.farmerId = req.user!.id;
    } else if (req.user!.activeRole === Role.DELIVERY) {
      where.deliveryJob = { deliveryPartnerId: req.user!.id };
    }
    // ADMIN falls through intentionally — sees everything

    // 3. Optional Status Filter
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }

    // 4. Database Transaction (Fetch & Count)
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { 
          crop: { 
            select: { 
              catalog : {select : {englishName : true, hindiName : true, imageTemplate : true}},
              photos: true 
            } 
          } 
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    // 5. Success Response
    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        }
      }
    });

  } catch (error) {
    console.error('Get Orders Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

export const getOrderById = async (req: Request<{id : string}>, res: Response): Promise<void> => {
  try {
    // 1. Extract ID
    const { id } = req.params;

    // 2. Fetch Order with Relations
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        crop: {
          select: {
            catalog : {select : {englishName : true, hindiName : true, imageTemplate : true}},
            photos: true,
            farmLatitude: true,
            farmLongitude: true,
            farmVillage: true,
            farmDistrict: true
          }
        },
        farmer: {
          select: {
            name: true,
            phone: true,
            rating: true
          }
        },
        buyer: {
          select: {
            name: true,
            phone: true
          }
        },
        deliveryJob: { 
          select: { 
            deliveryPartnerId: true 
          } 
        }
      }
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 3. The Security Gatekeeper (Privacy Check)
    const userId = req.user!.id;
    const role = req.user!.activeRole;

    const isInvolved = 
      role === Role.ADMIN ||
      order.farmerId === userId ||
      order.buyerId === userId ||
      order.deliveryJob?.deliveryPartnerId === userId;

    if (!isInvolved) {
      res.status(403).json({ success: false, message: 'You are not authorized to view this order' });
      return;
    }

    // 4. Success Response
    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Get Order By ID Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
};

export const confirmOrder = async (req: Request<{id : string}>, res: Response): Promise<void> => {
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
      res.status(403).json({ success: false, message: 'You are not authorized to confirm this order' });
      return;
    }

    // 3. The State Lock (Strictly PENDING only)
    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot confirm order. Current status is ${order.status}` 
      });
      return;
    }

    // 4. Update Status to CONFIRMED
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CONFIRMED }
    });

    // 5. Success Response
    res.status(200).json({
      success: true,
      message: 'Order confirmed successfully. Please prepare it for pickup/delivery.',
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
    const { reason } = req.body; // Optional string from frontend

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
      res.status(403).json({ success: false, message: 'You are not authorized to reject this order' });
      return;
    }

    // 3. The State Lock (Strictly PENDING only)
    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({ 
        success: false, 
        message: `Cannot reject order. Current status is ${order.status}` 
      });
      return;
    }

    // 4. The Magic Trick (Atomic Transaction - Restore Quantity & Cancel)
    const [, cancelledOrder] = await prisma.$transaction([
      
      // Query 1: Restore the reserved quantity back to the crop
      prisma.crop.update({
        where: { id: order.cropId },
        data: { 
          quantityRemainingKg: { increment: order.quantityKg } 
        }
      }),
      
      // Query 2: Mark order as CANCELLED
      prisma.order.update({
        where: { id },
        data: { 
          status: OrderStatus.CANCELLED,
          cancellationReason: reason || 'Cancelled by farmer'
        }
      })
    ]);

    // 5. Success Response
    res.status(200).json({
      success: true,
      message: 'Order rejected. Stock has been restored successfully.',
      data: cancelledOrder
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
