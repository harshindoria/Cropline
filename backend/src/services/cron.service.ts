import prisma from '../config/db';
import { DeliveryOfferStatus, OrderStatus } from '@prisma/client';

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

export function startCronJobs() {
    setInterval(() => {
        processDeliveryWaves().catch(console.error);
    }, 5 * 60 * 1000); // run every 5 mins
}
