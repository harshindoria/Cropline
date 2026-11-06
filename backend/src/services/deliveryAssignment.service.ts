import prisma from '../config/db';
import { VehicleType, Role, DeliveryJobStatus, OrderStatus, DeliveryOfferStatus, RoleAccessStatus } from '@prisma/client';
import { haversineDistance } from '../utils/geoUtils';

export const VEHICLE_CAPACITY = {
  [VehicleType.BIKE]: 50,
  [VehicleType.AUTO]: 300,
  [VehicleType.TEMPO]: 1000,
  [VehicleType.MINI_TRUCK]: 5000,
};

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
    include: { crop: { select: { farmLatitude: true, farmLongitude: true, farmVillage: true, farmDistrict: true } } }
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
      // A blocked partner can finish current work, but gets no new offers.
      roleAccess: { some: { role: Role.DELIVERY, status: RoleAccessStatus.ACTIVE } },
      isActive: true,
      deliveryProfile: { isOnline: true },
    },
    include: {
      deliveryProfile: true,
      deliveryJobs: {
        where: {
          status: {
            in: [DeliveryJobStatus.ASSIGNED, DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY]
          }
        }
      }
    }
  });

  // A partner who gave up this order is not offered it again.
  const released = await prisma.deliveryJob.findMany({
    where: { orderId, status: DeliveryJobStatus.CANCELLED },
    select: { deliveryPartnerId: true },
  });
  const releasedPartners = new Set(released.map((job) => job.deliveryPartnerId));

  const { farmLatitude, farmLongitude } = order.crop;

  // Filter by: free (no active job) + vehicle capacity + within radius of the farm
  const eligibleDrivers = allDrivers.filter(driver => {
    if (driver.deliveryJobs.length > 0 || releasedPartners.has(driver.id)) return false;
    if (driver.latitude === null || driver.longitude === null) return false;
    const vehicleType = driver.deliveryProfile?.vehicleType;
    if (!vehicleType) return false;
    if (VEHICLE_CAPACITY[vehicleType] < qty) return false;

    return haversineDistance(farmLatitude, farmLongitude, driver.latitude, driver.longitude) <= radiusKm;
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

  // Every broadcast is a new wave, so a partner from an earlier wave can be offered this order again.
  const { _max } = await prisma.deliveryOffer.aggregate({ where: { orderId }, _max: { wave: true } });
  const wave = (_max.wave ?? 0) + 1;

  // Create a DeliveryOffer + Notification for each eligible driver in parallel
  await Promise.all(
    eligibleDrivers.map(driver => {
      const distanceToPickup = haversineDistance(farmLatitude, farmLongitude, driver.latitude!, driver.longitude!);

      return prisma.$transaction([
        prisma.deliveryOffer.create({
          data: {
            orderId,
            partnerId: driver.id,
            status: DeliveryOfferStatus.OFFERED,
            wave,
            radiusKm,
            expiresAt: offerExpiresAt,
          }
        }),
        prisma.notification.create({
          data: {
            userId: driver.id,
            title: '🚚 New Delivery Job Available!',
            body: `Pickup: ${order.crop.farmVillage}, ${order.crop.farmDistrict} | Weight: ${qty}kg | Distance to pickup: ~${distanceToPickup.toFixed(1)}km | Earning: ₹${Number(order.deliveryPartnerPayout).toFixed(0)}`,
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

// ============================================================================
// EXPIRE OFFERS (Called by Cron)
// ============================================================================
// An offer past its time can no longer be accepted, so it must not count as "someone is still deciding".
export const expireStaleOffers = () =>
  prisma.deliveryOffer.updateMany({
    where: { status: DeliveryOfferStatus.OFFERED, expiresAt: { lt: new Date() } },
    data: { status: DeliveryOfferStatus.EXPIRED },
  });

// ============================================================================
// RELEASE A JOB (Partner gives up, or Cron finds no pickup)
// ============================================================================
/**
 * Puts an order back to finding a partner. Only allowed before pickup, because after that the goods
 * are with the partner. Returns false if the job has already moved on, so this is safe to repeat.
 */
export const releaseDeliveryJob = async (jobId: string, reason: string): Promise<boolean> => {
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deliveryJob.updateMany({
      where: { id: jobId, status: DeliveryJobStatus.ASSIGNED },
      data: { status: DeliveryJobStatus.CANCELLED, cancelledAt: now, cancellationReason: reason },
    });
    if (claimed.count !== 1) return null;

    const { orderId } = await tx.deliveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { orderId: true } });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERY_SEARCHING, dispatchStartedAt: now },
    });

    const body = 'Your delivery partner could not continue, so we are finding a new one.';
    await tx.notification.createMany({
      data: [updated.farmerId, updated.buyerId].map((userId) => ({
        userId,
        title: 'Finding a new delivery partner 🚚',
        body,
        data: { orderId },
      })),
    });
    return updated;
  });

  if (!order) return false;
  await broadcastDeliveryOffer(order.id);
  return true;
};
