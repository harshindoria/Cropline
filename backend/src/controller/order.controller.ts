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
    // 1. Validate request body
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

    // 2. Fetch Crop
    const crop = await prisma.crop.findUnique({
      where: { id: cropId }
    });

    if (!crop) {
      res.status(404).json({ success: false, message: 'Crop not found' });
      return;
    }

    // 3. Gatekeepers (Status and Ownership check)
    if (crop.status !== CropStatus.ACTIVE) {
      res.status(400).json({ success: false, message: 'This crop is not currently active for sale' });
      return;
    }
    
    if (crop.farmerId === buyerId) {
      res.status(403).json({ success: false, message: 'You cannot buy your own crop' });
      return;
    }

    // 4. Quantity Checks
    if (quantityKg < Number(crop.minOrderKg)) {
      res.status(400).json({ success: false, message: `Minimum order quantity is ${crop.minOrderKg} kg` });
      return;
    }
    
    if (quantityKg > Number(crop.quantityRemainingKg)) {
      res.status(400).json({ success: false, message: `Only ${crop.quantityRemainingKg} kg remaining in stock` });
      return;
    }

    // 5. Delivery & Payment Rules Check
    if (deliveryType === DeliveryType.DELIVERY && (!deliveryLatitude || !deliveryLongitude || !deliveryAddress)) {
      res.status(400).json({ success: false, message: 'Delivery coordinates and address are required for delivery' });
      return;
    }
    
    if (paymentType === PaymentType.CASH_ON_PICKUP && deliveryType === DeliveryType.DELIVERY) {
      res.status(400).json({ success: false, message: 'Cash on pickup is only available for self-pickup orders' });
      return;
    }

    // 6. Spam Protection
    const pendingOrdersCount = await prisma.order.count({
      where: { 
        buyerId, 
        status: OrderStatus.PENDING 
      }
    });
    
    if (pendingOrdersCount >= 5) {
      res.status(403).json({ success: false, message: 'You have too many pending orders. Please complete or cancel them first.' });
      return;
    }

    // 7. Money & Math (Calculate Fees)
    let deliveryFee = 0;
    if (deliveryType === DeliveryType.DELIVERY) {
      const distanceKm = haversineDistance(
        crop.farmLatitude, crop.farmLongitude, 
        deliveryLatitude!, deliveryLongitude!
      );
      deliveryFee = calculateDeliveryFee(distanceKm, quantityKg);
    }

    const pricePerKgNum = Number(crop.pricePerKg);
    const farmerEarnings = pricePerKgNum * quantityKg;
    const platformFee = farmerEarnings * 0.05; // 5% platform commission
    const totalAmount = farmerEarnings + platformFee + deliveryFee;

    // 8. THE ATOMIC TRANSACTION (Race Condition Protection)
    const [, newOrder] = await prisma.$transaction([
      
      // Query 1: Decrement the stock safely
      prisma.crop.update({
        where: { id: cropId },
        data: { 
          quantityRemainingKg: { decrement: quantityKg } 
        }
      }),
      
      // Query 2: Create the order
      prisma.order.create({
        data: {
          cropId,
          farmerId: crop.farmerId, // Extracted from crop table
          buyerId,
          quantityKg: new Prisma.Decimal(quantityKg),
          pricePerKg: crop.pricePerKg, // Direct from DB, already Decimal
          farmerEarnings: new Prisma.Decimal(farmerEarnings),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          platformFee: new Prisma.Decimal(platformFee),
          totalAmount: new Prisma.Decimal(totalAmount),
          deliveryType,
          paymentType,
          deliveryLatitude,
          deliveryLongitude,
          deliveryAddress,
          status: OrderStatus.PENDING
        }
      })
    ]);

    // 9. Success Response
    res.status(201).json({ 
      success: true, 
      message: 'Order placed successfully',
      data: newOrder 
    });

  } catch (error) {
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
    
    if (req.user!.role === Role.BUYER) {
      where.buyerId = req.user!.id;
    } else if (req.user!.role === Role.FARMER) {
      where.farmerId = req.user!.id;
    } else if (req.user!.role === Role.DELIVERY) {
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
              cropName: true, 
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
            cropName: true,
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
    const role = req.user!.role;

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