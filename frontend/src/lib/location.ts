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

export const getCurrentLocation = async (
  fallbackLat: number = 26.9124, 
  fallbackLng: number = 75.7873
): Promise<Coordinates> => {
  return new Promise<Coordinates>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ lat: fallbackLat, lng: fallbackLng });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn("Geolocation failed:", err);
        resolve({ lat: fallbackLat, lng: fallbackLng });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
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
