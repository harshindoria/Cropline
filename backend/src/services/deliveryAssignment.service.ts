import prisma from '../config/db';
import { VehicleType, Role, DeliveryJobStatus, OrderStatus } from '@prisma/client';
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

  // 2. Strict Distance Filter (Fallback): Delivery guy shouldn't be hundreds of km away
  // If they are not in the same district, they must be within their coverage radius (or default 50km)
  capableCandidates = capableCandidates.filter(c => {
    if (c.district === order.farmer.district) return true;
    const distance = haversineDistance(
      order.farmer.latitude || 0, order.farmer.longitude || 0,
      c.latitude || 0, c.longitude || 0
    );
    const maxRadius = c.coverageRadiusKm || 50;
    return distance <= maxRadius;
  });

  // Filter those without active jobs first
  let availableCandidates = capableCandidates.filter(c => c.deliveryJobs.length === 0);

  if (availableCandidates.length === 0) {
    availableCandidates = capableCandidates;
  }

  if (availableCandidates.length === 0) return null;

  // Sort by rating to give highest rated priority among ties
  availableCandidates.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const farmerPincode = order.farmer.pincode;
  const farmerDistrict = order.farmer.district;

  let selectedPartner = null;

  // Priority 1: Same Pincode & Preferred Vehicle
  selectedPartner = availableCandidates.find(c => c.pincode === farmerPincode && c.vehicleType === preferredVehicle);

  // Priority 2: Same Pincode & Any Capable Vehicle
  if (!selectedPartner) {
    selectedPartner = availableCandidates.find(c => c.pincode === farmerPincode);
  }

  // Priority 3: Same District & Preferred Vehicle
  if (!selectedPartner) {
    selectedPartner = availableCandidates.find(c => c.district === farmerDistrict && c.vehicleType === preferredVehicle);
  }

  // Priority 4: Same District & Any Capable Vehicle
  if (!selectedPartner) {
    selectedPartner = availableCandidates.find(c => c.district === farmerDistrict);
  }

  // Priority 5: Fallback to highest rated available (who is strictly within distance & weight capacity)
  if (!selectedPartner) {
    selectedPartner = availableCandidates[0];
  }

  if (selectedPartner) {
    // 24-hour deadline as requested
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); 

    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        deliveryPartnerId: selectedPartner.id,
        pickupLatitude: order.farmer.latitude || 0,
        pickupLongitude: order.farmer.longitude || 0,
        dropLatitude: order.buyer.latitude || 0,
        dropLongitude: order.buyer.longitude || 0,
        distanceKm: 0,
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

export const assignDeliveryJobByPincode = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { farmer: true, buyer: true }
  });

  if (!order || order.deliveryType !== 'DELIVERY' || !order.farmer.pincode) return null;

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
      pincode: order.farmer.pincode // STRICTLY SAME PINCODE
    },
    include: {
      deliveryJobs: {
        where: {
          status: { in: [DeliveryJobStatus.ASSIGNED, DeliveryJobStatus.PICKED_UP, DeliveryJobStatus.IN_DELIVERY] }
        }
      }
    }
  });

  let capableCandidates = candidates.filter(c => {
    if (!c.vehicleType) return false;
    return VEHICLE_CAPACITY[c.vehicleType] >= qty;
  });

  let availableCandidates = capableCandidates.filter(c => c.deliveryJobs.length === 0);
  if (availableCandidates.length === 0) {
    availableCandidates = capableCandidates;
  }
  if (availableCandidates.length === 0) return null;

  // Priority 1: Preferred Vehicle
  let selectedPartner = availableCandidates.find(c => c.vehicleType === preferredVehicle);
  // Priority 2: Any capable
  if (!selectedPartner) {
    selectedPartner = availableCandidates[0];
  }

  if (selectedPartner) {
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); 
    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        deliveryPartnerId: selectedPartner.id,
        pickupLatitude: order.farmer.latitude || 0,
        pickupLongitude: order.farmer.longitude || 0,
        dropLatitude: order.buyer.latitude || 0,
        dropLongitude: order.buyer.longitude || 0,
        distanceKm: 0,
        cropWeightKg: order.quantityKg,
        status: DeliveryJobStatus.ASSIGNED,
        estimatedDeliveryAt: deadline
      }
    });

    await prisma.notification.create({
      data: {
        userId: selectedPartner.id,
        title: 'New Priority Delivery Job! 🚚',
        body: `You got a priority assignment in your area (${order.farmer.pincode}). Deadline: ${deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        type: 'OFFER',
        data: { jobId: job.id, orderId: order.id }
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.ASSIGNED }
    });

    return selectedPartner;
  }

  return null;
}
