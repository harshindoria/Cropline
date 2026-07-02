import { VehicleType } from '@prisma/client';

export function calculateDeliveryFee(
    distanceKm : number,
    weightKg : number,
    vehicleType?: VehicleType | null
) : number {
    let baseFee = 50;
    let perKm = 10;

    switch(vehicleType) {
        case 'BIKE':
            baseFee = 40;
            perKm = 5;
            break;
        case 'AUTO':
            baseFee = 80;
            perKm = 10;
            break;
        case 'TEMPO':
            baseFee = 150;
            perKm = 15;
            break;
        case 'MINI_TRUCK':
            baseFee = 300;
            perKm = 25;
            break;
    }

    const fee = baseFee + (distanceKm * perKm);
    const weightPenalty = weightKg > 50 ? (weightKg - 50) * 2 : 0;
    
    return Math.round(fee + weightPenalty);
}