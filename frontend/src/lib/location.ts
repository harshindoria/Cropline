export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  formattedAddress?: string;
}

export interface GpsPosition extends Coordinates {
  accuracyMeters: number;
}

// This never falls back to a default place: anything that depends on the answer, like a
// delivery, has to know when the real location is unknown.
export const getGpsPosition = (): Promise<GpsPosition> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser does not support location."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
      (err) => {
        const messages: Record<number, string> = {
          [err.PERMISSION_DENIED]: "Location access is blocked. Allow it in your browser settings.",
          [err.POSITION_UNAVAILABLE]: "Your location is not available right now.",
          [err.TIMEOUT]: "Finding your location took too long.",
        };
        reject(new Error(messages[err.code] ?? "Could not get your location."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });

// The device's location, or the one saved on the user's profile if GPS is not available.
export const getGpsOrSavedLocation = async (
  saved?: { latitude?: unknown; longitude?: unknown } | null
): Promise<Coordinates> => {
  try {
    return await getGpsPosition();
  } catch (error) {
    if (saved?.latitude && saved?.longitude) {
      return { lat: Number(saved.latitude), lng: Number(saved.longitude) };
    }
    throw error;
  }
};

import api from '@/lib/axios';

export const reverseGeocode = async (lat: number, lng: number): Promise<GeocodeResult | null> => {
  try {
    const res = await api.post("/location/geocode", {
      latitude: lat,
      longitude: lng
    });

    const data = res.data?.data;
    console.log("Backend Geocode Response:", data);
    
    if (!data || data.error) {
      console.warn("Geocode failed. Response:", data);
      return null;
    }
    
    const address = data.address || {};

    const village = address.village || address.suburb || address.town || address.city || address.locality || "";
    const district = address.state_district || address.county || "";
    const state = address.state || "";
    const pincode = address.postcode || "";

    return {
      village,
      district,
      state,
      pincode,
      formattedAddress: data.display_name
    };
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return null;
  }
};

export const haversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateDeliveryFee = (
  distanceKm: number,
  weightKg: number
): number => {
  let baseFee = 50;
  let perKm = 10;
  const fee = baseFee + distanceKm * perKm;
  const weightPenalty = weightKg > 50 ? (weightKg - 50) * 2 : 0;
  return Math.round(fee + weightPenalty);
};
