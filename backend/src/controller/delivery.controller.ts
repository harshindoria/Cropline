import { Request, Response } from 'express';
import { Prisma, DeliveryJobStatus, OrderStatus, Role, DeliveryType, RoleAccessStatus, VerificationPurpose, VerificationTokenType} from '@prisma/client';
import prisma from '../config/db';
import { getIO } from '../sockets/socket.handler';
import { haversineDistance } from '../utils/geoUtils';
import { calculateDeliveryFee } from '../utils/feeUtils';
// import { uploadToCloudinary } from '../utils/cloudinaryUpload'; // Aage baaki APIs mein kaam aayega
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

// ── GET NEARBY JOBS (The Radar) ─────────────────────────────────────────────
export const getNearbyJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Your current coordinates (lat and lng) are required',
      });
      return;
    }

    // Delivery partner must have a vehicle type set
    if (!req.user!.vehicleType) {
      res.status(400).json({
        success: false,
        message: 'Please set your vehicle type in your profile before accepting jobs',
      });
      return;
    }

    const userLat = Number(lat);
    const userLng = Number(lng);
    const radiusKm = Number(radius) || 10; // Default 10km radius

    // ── BOUNDING BOX MATH (Rough Filter for DB) ──
    const LAT_DEGREE_KM = 111;
    const latDelta = radiusKm / LAT_DEGREE_KM;
    const lonDelta = radiusKm / (LAT_DEGREE_KM * Math.cos(userLat * (Math.PI / 180)));

    const minLat = userLat - latDelta;
    const maxLat = userLat + latDelta;
    const minLng = userLng - lonDelta;
    const maxLng = userLng + lonDelta;

    // 1. Prisma Query with Bounding Box optimization
    const availableOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.READY_FOR_PICKUP,
        deliveryType: DeliveryType.DELIVERY,
        deliveryJob: null, // Ensure job is not already accepted
        crop: {
          farmLatitude: { gte: minLat, lte: maxLat },
          farmLongitude: { gte: minLng, lte: maxLng },
        },
      },
      include: {
        crop: {
          select: {
            catalog: {
              select: {
                englishName: true
              }
            },
            farmLatitude: true,
            farmLongitude: true,
            farmVillage: true,
            farmDistrict: true,
            farmState : true,
            photos: true,
          },
        },
        farmer: {
          select: { name: true },
        },
      },
    });

    // 2. Exact Filter & Sort in Memory
    const nearbyJobs = availableOrders
      .map((order) => {
        // Distance from delivery partner to farm
        const distanceToFarmKm = haversineDistance(
          userLat, 
          userLng,
          Number(order.crop.farmLatitude), 
          Number(order.crop.farmLongitude)
        );

        // Distance from farm to buyer (for fee calculation)
        const deliveryDistanceKm = (order.deliveryLatitude && order.deliveryLongitude)
          ? haversineDistance(
              Number(order.crop.farmLatitude), Number(order.crop.farmLongitude),
              Number(order.deliveryLatitude), Number(order.deliveryLongitude)
            )
          : 0;

        const estimatedFee = calculateDeliveryFee(deliveryDistanceKm, Number(order.quantityKg));

        const totalDistanceKm = distanceToFarmKm + deliveryDistanceKm;
        const estimatedTimeMins = Math.round((totalDistanceKm / 30) * 60);
        
        let expiresAt = null;
        if (order.farmerAcceptedAt) {
          expiresAt = new Date(new Date(order.farmerAcceptedAt).getTime() + 6 * 60 * 60 * 1000);
        }

        return {
          orderId: order.id,
          cropName: order.crop.catalog.englishName,
          cropPhoto: order.crop.photos[0] || null,
          farmLocation: {
            village: order.crop.farmVillage,
            district: order.crop.farmDistrict,
            state : order.crop.farmState,
            latitude: order.crop.farmLatitude,
            longitude: order.crop.farmLongitude,
          },
          dropAddress: order.deliveryAddress,
          weightKg: Number(order.quantityKg),
          pickupDistanceKm: Math.round(distanceToFarmKm * 10) / 10,
          totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
          estimatedFee,
          estimatedTimeMins,
          farmerName: order.farmer.name,
          expiresAt,
        };
      })
      .filter((job) => job.pickupDistanceKm <= radiusKm)
      .sort((a, b) => a.pickupDistanceKm - b.pickupDistanceKm); // Nearest first

    res.status(200).json({
      success: true,
      data: { jobs: nearbyJobs, total: nearbyJobs.length },
    });

  } catch (error) {
    console.error('[Delivery] Get Nearby Jobs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch nearby jobs' });
  }
};

export const acceptJob = async (req: Request<{orderId : string}>, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    // 1. Fetch Order along with Crop details and check if job already exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        crop: {
          select: {
            farmLatitude: true,
            farmLongitude: true,
            farmVillage: true,
            farmDistrict: true,
          },
        },
        deliveryJob: true, // Checking if someone else already took it
        deliveryOffers: {
          where: {
            partnerId: req.user!.id,
            status: 'OFFERED',
            expiresAt: { gte: new Date() },
          },
          select: { id: true },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // 2. The Gatekeeper: State Locks
    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      res.status(400).json({ success: false, message: 'This job is no longer available for pickup' });
      return;
    }

    if (order.deliveryType !== DeliveryType.DELIVERY) {
      res.status(400).json({ success: false, message: 'This is a self-pickup order' });
      return;
    }

    // Pre-check for race condition (Though DB constraint is the ultimate guard)
    if (order.deliveryJob) {
      res.status(409).json({ success: false, message: 'Another delivery partner has already accepted this job' });
      return;
    }
    if (order.deliveryOffers.length === 0) {
      res.status(403).json({ success: false, message: 'This delivery offer is unavailable or has expired.' });
      return;
    }

    if (!order.deliveryLatitude || !order.deliveryLongitude) {
      res.status(400).json({ success: false, message: 'Order is missing delivery destination coordinates' });
      return;
    }

    if (order.farmerId === req.user!.id || order.buyerId === req.user!.id) {
      res.status(403).json({ success: false, code: 'SELF_DEALING', message: 'You cannot deliver your own purchase or sale.' }); return;
    }

    const vehicleLimits: Record<string, number> = { BIKE: 20, AUTO: 100, TEMPO: 500, MINI_TRUCK: 2000 };
    const capacity = req.user!.vehicleType ? vehicleLimits[req.user!.vehicleType] : 0;
    if (Number(order.quantityKg) > capacity) {
      res.status(403).json({ success: false, code: 'VEHICLE_CAPACITY_EXCEEDED', message: `Your vehicle supports up to ${capacity} kg.` }); return;
    }

    // 4. Distance and Time Estimation Math
    const distanceKm = haversineDistance(
      order.crop.farmLatitude, order.crop.farmLongitude,
      order.deliveryLatitude, order.deliveryLongitude
    );
    
    // Asli duniya mein average bike speed 30km/h maankar minutes calculate karna
    const estimatedMinutes = Math.round((distanceKm / 30) * 60);
    const estimatedDeliveryAt = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    // 5. THE ATOMIC TRANSACTION (The Ultimate Race Guard)
    const [deliveryJob] = await prisma.$transaction([
      
      // Query 1: Create the Job (Throws P2002 if orderId already exists)
      prisma.deliveryJob.create({
        data: {
          orderId,
          deliveryPartnerId: req.user!.id,
          pickupLatitude: order.crop.farmLatitude,
          pickupLongitude: order.crop.farmLongitude,
          dropLatitude: order.deliveryLatitude,
          dropLongitude: order.deliveryLongitude,
          distanceKm,
          cropWeightKg: order.quantityKg, // Passing Decimal directly from order
          estimatedDeliveryAt,
          status: DeliveryJobStatus.ASSIGNED
        },
      }),

      // Query 2: Lock the Order
      prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ASSIGNED },
      }),
      prisma.deliveryOffer.update({
        where: { id: order.deliveryOffers[0].id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
      prisma.deliveryOffer.updateMany({
        where: { orderId, id: { not: order.deliveryOffers[0].id }, status: 'OFFERED' },
        data: { status: 'LOST', respondedAt: new Date() },
      }),
    ]);

    // 6. Real-Time Engine (Socket.io Pings)
    const io = getIO();

    // Ping the Farmer
    io.to(`user:${order.farmerId}`).emit('order:assigned', {
      orderId,
      message: 'A delivery partner has accepted your order and is on the way to your farm.',
      deliveryPartnerName: req.user!.name || 'Delivery Partner',
    });

    // Ping the Buyer
    io.to(`user:${order.buyerId}`).emit('order:assigned', {
      orderId,
      message: 'A delivery partner is heading to pick up your order.',
      estimatedDeliveryAt,
    });

    // 7. Success Response
    res.status(201).json({
      success: true,
      message: 'Job accepted successfully',
      data: {
        jobId: deliveryJob.id,
        orderId,
        pickupLocation: {
          latitude: order.crop.farmLatitude,
          longitude: order.crop.farmLongitude,
          village: order.crop.farmVillage,
          district: order.crop.farmDistrict,
        },
        dropLocation: {
          latitude: order.deliveryLatitude,
          longitude: order.deliveryLongitude,
          address: order.deliveryAddress,
        },
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedDeliveryAt,
        // Frontend ko fee dikhane ke liye order table se bhej rahe hain
        deliveryFee: order.deliveryFee 
      },
    });

  } catch (error) {
    // THE BOUNCER: Handling PostgreSQL Unique Constraint Violation
    if ((error as any)?.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Too late! Another delivery partner just accepted this job.',
      });
      return;
    }

    console.error('[Delivery] Accept Job Error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept job' });
  }
};

export const markPickedUp = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Extract data and file
    const { token, lat, lng, jobId } = req.body;
    const file = req.file as Express.Multer.File;

    // 2. Primary Validations
    if (!token) {
      res.status(400).json({ success: false, message: 'Pickup OTP is required.' });
      return;
    }
    if (!jobId) {
      res.status(400).json({ success: false, message: 'Job ID is required.' });
      return;
    }
    if (!lat || !lng) {
      res.status(400).json({ success: false, message: 'Your current GPS coordinates are required.' });
      return;
    }
    if (!file) {
      res.status(400).json({ success: false, message: 'Pickup photo is strictly required as proof.' });
      return;
    }

    // 4. Database & State Guard Checks
    const job = await prisma.deliveryJob.findUnique({
      where: { id: jobId },
      include: { order: true },
    });

    if (!job) {
      res.status(404).json({ success: false, message: 'No delivery job found.' });
      return;
    }
    if (job.deliveryPartnerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Unauthorized action. This job belongs to another partner.' });
      return;
    }
    if (job.status !== DeliveryJobStatus.ASSIGNED) {
      res.status(400).json({ success: false, message: `Package already processed. Status: ${job.status}` });
      return;
    }
    if (job.order.pickupOtp !== token) {
      res.status(400).json({ success: false, message: 'Invalid pickup OTP.' });
      return;
    }

    // 5. Cloudinary Upload (The New Addition)
    let pickupPhotoUrl: string;
    try {
      // Uploading to a specific folder for pickups
      pickupPhotoUrl = await uploadToCloudinary(file.buffer, 'khetse/pickups');
    } catch (uploadError) {
      console.error('[Delivery] Pickup Photo Upload Error:', uploadError);
      res.status(500).json({ success: false, message: 'Failed to upload pickup proof.' });
      return;
    }

    const now = new Date();

    // 6. THE ATOMIC TRANSACTION
    await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.deliveryJob.updateMany({
        where: { id: job.id, status: DeliveryJobStatus.ASSIGNED },
        data: {
          status: DeliveryJobStatus.PICKED_UP,
          pickedUpAt: now,
          pickupPhoto: pickupPhotoUrl,
          liveLatitude: Number(lat),
          liveLongitude: Number(lng),
          liveLocationUpdatedAt: now,
        },
      });

      if (updatedJob.count !== 1) {
        throw new Error('JOB_ALREADY_PROCESSED');
      }

      await tx.order.update({
        where: { id: job.orderId },
        data: { status: OrderStatus.PICKED_UP },
      });

      // Persistent Notification for Farmer
      await tx.notification.create({
        data: {
          userId: job.order.farmerId,
          type: 'GENERAL',
          title: 'Order Picked Up 📦',
          body: 'Your produce has been successfully handed over to the delivery partner.',
          data: { orderId: job.orderId, jobId: job.id }
        }
      });

      // Persistent Notification for Buyer
      await tx.notification.create({
        data: {
          userId: job.order.buyerId,
          type: 'GENERAL',
          title: 'Order is on the way! 🚚',
          body: 'Your order has been picked up from the farm and is now out for delivery.',
          data: { orderId: job.orderId, jobId: job.id }
        }
      });
    });

    // 7. REAL-TIME NOTIFICATIONS
    const io = getIO();
    io.to(`user:${job.order.farmerId}`).emit('order:picked_up', {
      orderId: job.orderId,
      message: 'The produce has been successfully handed over to the delivery partner.',
    });
    io.to(`user:${job.order.buyerId}`).emit('order:picked_up', {
      orderId: job.orderId,
      jobId: job.id,
      message: 'Your order has been picked up from the farm and is on the way!',
      pickupPhoto: pickupPhotoUrl, // Buyer can see the package condition
      estimatedDeliveryAt: job.estimatedDeliveryAt,
    });

    // 8. Success Response
    res.status(200).json({
      success: true,
      message: 'Secure pickup verification successful. Transit initiated.',
      data: {
        jobId: job.id,
        orderId: job.orderId,
        status: 'PICKED_UP',
        pickedUpAt: now,
        pickupPhotoUrl, // 👈 Returned to frontend
      },
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'JOB_ALREADY_PROCESSED') {
      res.status(409).json({ success: false, message: 'This pickup was already processed.' });
      return;
    }
    console.error('[Delivery] Mark Picked Up Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during pickup verification.' });
  }
};

// ── UPDATE LIVE LOCATION (The GPS Ping) ─────────────────────────────────────
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, orderId } = req.body;

    // 1. Data Validation
    if (!lat || !lng || !orderId) {
      res.status(400).json({
        success: false,
        message: 'Coordinates (lat, lng) and orderId are required.',
      });
      return;
    }

    // 2. Active Job Verification
    // Hum sirf wahi job update karenge jo actually abhi raste mein hai
    const job = await prisma.deliveryJob.findFirst({
      where: {
        orderId,
        deliveryPartnerId: req.user!.id, // Security: Dusra driver update na kar sake
        status: {
          in: [DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY],
        },
      },
    });

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'No active delivery job found for this order. Tracking is disabled.',
      });
      return;
    }

    const now = new Date();

    // 3. Database Update (The Anchor)
    await prisma.deliveryJob.update({
      where: { id: job.id },
      data: {
        liveLatitude: Number(lat),
        liveLongitude: Number(lng),
        liveLocationUpdatedAt: now,
      },
    });

    // 4. Socket.io Broadcast (The Live Magic)
    const io = getIO();
    io.to(`order:${orderId}`).emit('delivery:location:broadcast', {
      lat: Number(lat),
      lng: Number(lng),
      timestamp: now.toISOString(),
    });

    // 5. The Pro Return (Zero JSON body to save server bandwidth)
    res.status(204).send();

  } catch (error) {
    console.error('[Delivery] Update Location Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update live location.' 
    });
  }
};

export const markDelivered = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const { token } = req.body;

    // 1. Proof of Delivery Validation
    const file = req.file as Express.Multer.File;
    if (!token) {
      res.status(400).json({ success: false, message: 'Delivery OTP is required.' });
      return;
    }
    if (!file) {
      res.status(400).json({ 
        success: false, 
        message: 'Delivery photo is strictly required as proof of delivery.' 
      });
      return;
    }

    // 2. Fetch Job with Order's Financial Details
    const job = await prisma.deliveryJob.findUnique({
      where: { id: jobId as string},
      include: {
        order: { include: { paymentRecord: true } },
      },
    });

    if (!job) {
      res.status(404).json({ success: false, message: 'Delivery job not found.' });
      return;
    }

    // 3. Security & State Guards
    if (job.deliveryPartnerId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Unauthorized action. This is not your delivery job.' });
      return;
    }

    if (
      job.status !== DeliveryJobStatus.PICKED_UP &&
      job.status !== DeliveryJobStatus.IN_DELIVERY
    ) {
      res.status(400).json({ success: false, message: `Cannot mark delivered. Current job status is ${job.status}.` });
      return;
    }

    if (job.order.deliveryOtp !== token) {
      res.status(400).json({ success: false, message: 'Invalid delivery OTP.' });
      return;
    }

    if (job.order.paymentType === 'ONLINE' && job.order.paymentRecord?.status !== 'SUCCESS') {
      res.status(409).json({ success: false, message: 'Online payment must be completed before delivery verification.' });
      return;
    }

    // 4. Upload Delivery Proof to Cloudinary
    let deliveryPhotoUrl: string;
    try {
      deliveryPhotoUrl = await uploadToCloudinary(file.buffer, 'cropland/deliveries');
    } catch (uploadError) {
      console.error('[Delivery] Cloudinary Upload Error:', uploadError);
      res.status(500).json({ success: false, message: 'Failed to upload delivery photo.' });
      return;
    }

    const now = new Date();

    // 5. THE ATOMIC TRANSACTION for final delivery
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({
        where: { id: jobId as string },
        data: {
          status: DeliveryJobStatus.DELIVERED,
          deliveredAt: now,
          deliveryPhoto: deliveryPhotoUrl,
        },
      });

      await tx.order.update({
        where: { id: job.orderId },
        data: { status: 'DELIVERED', completedAt: now },
      });

      if (job.order.paymentType === 'CASH_ON_PICKUP') {
        await tx.paymentRecord.update({
          where: { orderId: job.orderId },
          data: { status: 'SUCCESS', capturedAt: now },
        });
        await tx.cashLiability.upsert({
          where: { orderId: job.orderId },
          create: { orderId: job.orderId, deliveryPartnerId: job.deliveryPartnerId, amount: job.order.totalBuyerPrice },
          update: {},
        });
      }

      await tx.user.update({ where: { id: job.deliveryPartnerId }, data: { walletBalance: { increment: job.order.deliveryPartnerPayout } } });
      await tx.user.update({ where: { id: job.order.farmerId }, data: { walletBalance: { increment: job.order.farmerEarnings } } });

      // Notify Farmer
      await tx.notification.create({
        data: {
          userId: job.order.farmerId,
          type: 'GENERAL',
          title: 'Order Delivered! 🎉',
          body: 'Your produce has been successfully delivered to the buyer. Earnings added to wallet.',
          data: { orderId: job.orderId, jobId: job.id }
        }
      });

      // Notify Buyer
      await tx.notification.create({
        data: {
          userId: job.order.buyerId,
          type: 'GENERAL',
          title: 'Order Delivered! 🎉',
          body: 'Your order has been delivered successfully. Enjoy your fresh produce!',
          data: { orderId: job.orderId, jobId: job.id }
        }
      });
    });

    res.status(200).json({
      success: true,
      message: 'Delivery and payment verified successfully.',
      data: {
        jobId,
        status: DeliveryJobStatus.DELIVERED,
        deliveryPhotoUrl,
      },
    });

  } catch (error) {
    console.error('[Delivery] Mark Delivered Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while confirming delivery.' 
    });
  }
};

// ── GET ACTIVE JOBS ─────────────────────────────────────────────
export const getActiveJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const activeJobsRaw = await prisma.deliveryJob.findMany({
      where: {
        deliveryPartnerId: req.user!.id,
        OR: [
          { status: { in: [DeliveryJobStatus.ASSIGNED, DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY] } },
          { status: DeliveryJobStatus.DELIVERED, deliveredAt: { gte: startOfDay } }
        ]
      },
      include: {
        order: {
          include: {
            paymentRecord: true,
            crop: { include: { catalog: true } },
            farmer: { select: { name: true, phone: true } },
            buyer: { select: { name: true, phone: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedJobs = activeJobsRaw.map(job => {
      return {
        jobId: job.id,
        orderId: job.order.id,
        status: job.status,
        cropName: job.order.crop.catalog.englishName,
        weightKg: Number(job.cropWeightKg),
        estimatedFee: job.order.deliveryFee,
        paymentType: job.order.paymentType,
        paymentStatus: job.order.paymentRecord?.status || 'PENDING',
        totalBuyerPrice: job.order.totalBuyerPrice,
        pickupLocation: {
          latitude: job.pickupLatitude,
          longitude: job.pickupLongitude,
          village: job.order.crop.farmVillage,
          district: job.order.crop.farmDistrict,
          state: job.order.crop.farmState,
        },
        dropLocation: {
          latitude: job.dropLatitude,
          longitude: job.dropLongitude,
          address: job.order.deliveryAddress,
        },
        farmer: job.order.farmer,
        buyer: job.order.buyer,
        estimatedDeliveryAt: job.estimatedDeliveryAt,
        acceptedAt: job.acceptedAt,
        pickedUpAt: job.pickedUpAt,
        deliveredAt: job.deliveredAt,
        distanceKm: job.distanceKm
      };
    });

    const inProgress = mappedJobs.filter(j => j.status !== DeliveryJobStatus.DELIVERED);
    const completedToday = mappedJobs.filter(j => j.status === DeliveryJobStatus.DELIVERED);

    res.status(200).json({
      success: true,
      data: { inProgress, completedToday }
    });

  } catch (error) {
    console.error('[Delivery] Get Active Jobs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active jobs' });
  }
};
