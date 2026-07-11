'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issues with Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Create custom icons
const myLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const farmIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function RecenterMap({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [lat, lng, map]);
  return null;
}

interface DeliveryMapProps {
  userLat: number;
  userLng: number;
  jobs: any[];
}

export default function DeliveryMap({ userLat, userLng, jobs }: DeliveryMapProps) {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative z-0">
      <MapContainer 
        center={[userLat, userLng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={userLat} lng={userLng} />

        {/* User Location */}
        <Marker position={[userLat, userLng]} icon={myLocationIcon}>
          <Popup>
            <div className="font-bold text-center">You are here</div>
          </Popup>
        </Marker>

        {/* Farm Locations */}
        {jobs.map((job) => (
          <Marker 
            key={job.orderId}
            position={[Number(job.farmLocation.latitude), Number(job.farmLocation.longitude)]}
            icon={farmIcon}
          >
            <Popup>
              <div className="text-center">
                <p className="font-bold text-[#1B5E20]">{job.cropName}</p>
                <p className="text-xs text-gray-500">{job.pickupDistanceKm} km away</p>
                <p className="text-xs font-semibold mt-1">₹{job.estimatedFee}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
