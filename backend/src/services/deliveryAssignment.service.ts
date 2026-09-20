import prisma from '../config/db';
import { VehicleType, Role, DeliveryJobStatus, OrderStatus, DeliveryOfferStatus } from '@prisma/client';
import { haversineDistance } from '../utils/geoUtils';

const VEHICLE_CAPACITY = {
  [VehicleType.BIKE]: 50,
  [VehicleType.AUTO]: 300,
  [VehicleType.TEMPO]: 1000,
  [VehicleType.MINI_TRUCK]: 5000,
};

export const assignDeliveryJob = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { farmer: true, buyer: true }
  });

  if (!order || order.deliveryType !== 'DELIVERY') return null;

  const qty = Number(order.quantityKg);

  // Preferred vehicle based on weight
  let preferredVehicle: VehicleType = VehicleType.MINI_TRUCK;
  if (qty <= 50) preferredVehicle = VehicleType.BIKE;
  else if (qty <= 300) preferredVehicle = VehicleType.AUTO;
  else if (qty <= 1000) preferredVehicle = VehicleType.TEMPO;

  const candidates = await prisma.user.findMany({
    where: {
      roles: { has: Role.DELIVERY },
      isActive: true,
      isOnline: true,
    },
    include: {
      deliveryJobs: {
        where: {
          status: { in: [DeliveryJobStatus.ASSIGNED, DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY] }
        }
      }
    }
  });

  // 1. Strict Capacity Filter: Eliminate vehicles that cannot carry the crop
  let capableCandidates = candidates.filter(c => {
    if (!c.vehicleType) return false;
    return VEHICLE_CAPACITY[c.vehicleType] >= qty;
  });

  // 2. Distance Filter: Delivery guy must be within their coverage radius (default 20km)
  const candidatesWithDistance = capableCandidates.map(c => {
    const distance = haversineDistance(
      order.farmer.latitude || 0, order.farmer.longitude || 0,
      c.latitude || 0, c.longitude || 0
    );
    return { ...c, distanceToPickup: distance };
  });

  const validDistanceCandidates = candidatesWithDistance.filter(c => {
    const maxRadius = c.coverageRadiusKm || 20;
    return c.distanceToPickup <= maxRadius;
  });

  // Filter those without active jobs first
  let availableCandidates = validDistanceCandidates.filter(c => c.deliveryJobs.length === 0);

  if (availableCandidates.length === 0) {
    availableCandidates = validDistanceCandidates;
  }

  if (availableCandidates.length === 0) return null;

  // Sort by Priority:
  // 1. Preferred Vehicle (True > False)
  // 2. Distance (Closest > Furthest)
  // 3. Rating (Highest > Lowest)
  availableCandidates.sort((a, b) => {
    const aIsPreferred = a.vehicleType === preferredVehicle ? 1 : 0;
    const bIsPreferred = b.vehicleType === preferredVehicle ? 1 : 0;
    
    if (aIsPreferred !== bIsPreferred) return bIsPreferred - aIsPreferred; // Preferred first
    if (a.distanceToPickup !== b.distanceToPickup) return a.distanceToPickup - b.distanceToPickup; // Closest first
    return (b.rating || 0) - (a.rating || 0); // Highest rated first
  });

  const selectedPartner = availableCandidates[0];

  if (selectedPartner) {
    // 24-hour deadline as requested
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); 

    const jobDistance = haversineDistance(
      order.farmer.latitude || 0, order.farmer.longitude || 0,
      order.deliveryLatitude || 0, order.deliveryLongitude || 0
    );

    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        deliveryPartnerId: selectedPartner.id,
        pickupLatitude: order.farmer.latitude || 0,
        pickupLongitude: order.farmer.longitude || 0,
        dropLatitude: order.deliveryLatitude || 0,
        dropLongitude: order.deliveryLongitude || 0,
        distanceKm: jobDistance,
        cropWeightKg: order.quantityKg,
        status: DeliveryJobStatus.ASSIGNED,
        estimatedDeliveryAt: deadline
      }
    });

    // Notify partner
    await prisma.notification.create({
      data: {
        userId: selectedPartner.id,
        title: 'New Delivery Job Assigned! 🚚',
        body: `You have been assigned a pickup at ${order.farmer.village}, ${order.farmer.district}. Deadline: ${deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        type: 'OFFER',
        data: { jobId: job.id, orderId: order.id }
      }
    });

    // Update order status to ASSIGNED
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.ASSIGNED }
    });

    return selectedPartner;
  }

  return null;
}

// ============================================================================
// BROADCAST DELIVERY OFFER (Pull/Radar Model)
// ============================================================================
// Ye function silently assign nahi karta. Ye eligible drivers ko notify karta
// hai aur DB me DeliveryOffer records banata hai. Jo sabse pahle accept karega
// use job milegi (handled by acceptJob in delivery.controller.ts).

export const broadcastDeliveryOffer = async (
  orderId: string,
  radiusKm: number = 10
): Promise<number> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { farmer: true }
  });

  if (
    !order ||
    order.deliveryType !== 'DELIVERY' ||
    order.status !== OrderStatus.DELIVERY_SEARCHING
  ) {
    console.log(`[BROADCAST] Skipping order ${orderId} — not eligible.`);
    return 0;
  }

  const qty = Number(order.quantityKg);

  // Fetch all online + active delivery partners
  const allDrivers = await prisma.user.findMany({
    where: {
      roles: { has: Role.DELIVERY },
      isActive: true,
      isOnline: true,
    },
    include: {
      deliveryJobs: {
        where: {
          status: {
            in: [DeliveryJobStatus.ASSIGNED, DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY]
          }
        }
      }
    }
  });

  // Filter by: free (no active job) + vehicle capacity + within radius
  const eligibleDrivers = allDrivers.filter(driver => {
    if (driver.deliveryJobs.length > 0) return false;
    if (!driver.vehicleType) return false;
    if (VEHICLE_CAPACITY[driver.vehicleType] < qty) return false;

    const distance = haversineDistance(
      order.farmer.latitude || 0, order.farmer.longitude || 0,
      driver.latitude || 0, driver.longitude || 0
    );
    return distance <= radiusKm;
  });

  if (eligibleDrivers.length === 0) {
    console.log(`[BROADCAST] No eligible drivers within ${radiusKm}km for order ${orderId}.`);
    return 0;
  }

  // Expire any old pending offers for a clean slate
  await prisma.deliveryOffer.updateMany({
    where: { orderId, status: DeliveryOfferStatus.OFFERED },
    data: { status: DeliveryOfferStatus.EXPIRED }
  });

  const offerExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  // Create a DeliveryOffer + Notification for each eligible driver in parallel
  await Promise.all(
    eligibleDrivers.map(driver => {
      const distanceToPickup = haversineDistance(
        order.farmer.latitude || 0, order.farmer.longitude || 0,
        driver.latitude || 0, driver.longitude || 0
      );

      return prisma.$transaction([
        prisma.deliveryOffer.create({
          data: {
            orderId,
            partnerId: driver.id,
            status: DeliveryOfferStatus.OFFERED,
            wave: 1,
            radiusKm,
            expiresAt: offerExpiresAt,
          }
        }),
        prisma.notification.create({
          data: {
            userId: driver.id,
            title: '🚚 New Delivery Job Available!',
            body: `Pickup: ${order.farmer.village}, ${order.farmer.district} | Weight: ${qty}kg | Distance to pickup: ~${distanceToPickup.toFixed(1)}km | Earning: ₹${Number(order.deliveryPartnerPayout).toFixed(0)}`,
            type: 'OFFER',
            data: {
              orderId,
              distanceToPickupKm: distanceToPickup.toFixed(1),
              weightKg: qty,
              earning: Number(order.deliveryPartnerPayout).toFixed(0),
              expiresAt: offerExpiresAt.toISOString(),
            }
          }
        })
      ]);
    })
  );

  console.log(`[BROADCAST] Sent offer to ${eligibleDrivers.length} drivers within ${radiusKm}km for order ${orderId}.`);
  return eligibleDrivers.length;
};

// ============================================================================
// RETRY WITH EXPANDED RADIUS (Called by Cron after 2 hours)
// ============================================================================

export const retryBroadcastWithExpandedRadius = async (orderId: string): Promise<void> => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  // If already assigned or cancelled, nothing to do
  if (!order || order.status !== OrderStatus.DELIVERY_SEARCHING) return;

  // Check if any offers are still pending (someone might still be reviewing)
  const pendingOffers = await prisma.deliveryOffer.count({
    where: { orderId, status: DeliveryOfferStatus.OFFERED }
  });

  if (pendingOffers > 0) {
    console.log(`[BROADCAST] Order ${orderId} still has ${pendingOffers} active offer(s). Waiting...`);
    return;
  }

  // No takers within 2 hours — expand radius to 20km and re-broadcast
  console.log(`[BROADCAST] No takers for order ${orderId}. Expanding radius to 20km...`);
  await broadcastDeliveryOffer(orderId, 20);
};
