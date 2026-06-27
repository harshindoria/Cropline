export function calculateDeliveryFee(
    distanceKm : number,
    weightKg : number
) : number {
    if(distanceKm<=5){
        if(weightKg<=5)return 50;
        else return 100;
    }

    if(distanceKm<=15){
        if(weightKg<=10)return 150;
        else return 250;
    }

    const perKmCharge = 10;

    return Math.round(perKmCharge*distanceKm);
}