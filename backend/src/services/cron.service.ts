import prisma from '../config/db';
import { DeliveryOfferStatus, OrderStatus, DeliveryJobStatus } from '@prisma/client';
import { haversineDistance } from '../utils/geoUtils';

export async function processDeliveryWaves() {
  // Find all OFFERED that are expired
  const expiredOffers = await prisma.deliveryOffer.findMany({
    where: {
      status: DeliveryOfferStatus.OFFERED,
      expiresAt: { lt: new Date() }
    },
    include: { order: true }
  });

  for (const offer of expiredOffers) {
    await prisma.deliveryOffer.update({
      where: { id: offer.id },
      data: { status: DeliveryOfferStatus.EXPIRED }
    });
    
    // Find next partner
    const nextPartner = await prisma.user.findFirst({
        where: {
            roles: { has: 'DELIVERY' },
            isActive: true,
            isOnline: true,
            id: { notIn: [offer.partnerId] }
        }
    });

    if (nextPartner) {
        // Create new offer
        await prisma.deliveryOffer.create({
            data: {
                orderId: offer.orderId,
                partnerId: nextPartner.id,
                wave: offer.wave + 1,
                radiusKm: offer.radiusKm + 5,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
            }
        });
        // Here we would also send a socket notification to the nextPartner
    } else {
        await prisma.order.update({
            where: { id: offer.orderId },
            data: { status: OrderStatus.DELIVERY_UNAVAILABLE }
        });
    }
  }
}

export async function processAutoAssignDeliveries() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  
  const unassignedOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.READY_FOR_PICKUP,
      deliveryType: 'DELIVERY',
      farmerAcceptedAt: { lte: sixHoursAgo }
    },
    include: { crop: true }
  });

  if (unassignedOrders.length === 0) return;

  const onlineDeliveryBoys = await prisma.user.findMany({
    where: { activeRole: 'DELIVERY', isOnline: true }
  });

  if (onlineDeliveryBoys.length === 0) return;

  for (const order of unassignedOrders) {
    if (!order.crop.farmLatitude || !order.crop.farmLongitude) continue;

    let nearestBoy = null;
    let minDistance = Infinity;

    for (const boy of onlineDeliveryBoys) {
      if (!boy.latitude || !boy.longitude) continue;
      const dist = haversineDistance(
        order.crop.farmLatitude,
        order.crop.farmLongitude,
        boy.latitude,
        boy.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestBoy = boy;
      }
    }

    if (nearestBoy) {
      // Auto assign
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.$transaction([
        prisma.deliveryJob.create({
          data: {
            orderId: order.id,
            deliveryPartnerId: nearestBoy.id,
            pickupLatitude: order.crop.farmLatitude,
            pickupLongitude: order.crop.farmLongitude,
            dropLatitude: order.deliveryLatitude || 0,
            dropLongitude: order.deliveryLongitude || 0,
            distanceKm: minDistance,
            cropWeightKg: order.quantityKg,
            status: DeliveryJobStatus.ASSIGNED,
            estimatedDeliveryAt: deadline
          }
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ASSIGNED }
        })
      ]);
    }
  }
}

export function startCronJobs() {
    setInterval(() => {
        processDeliveryWaves().catch(console.error);
        processAutoAssignDeliveries().catch(console.error);
    }, 5 * 60 * 1000); // run every 5 mins
}
