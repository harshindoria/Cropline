import Link from "next/link";
import type { Crop, CropCategory, CropListing, CropNameSource } from "@/types/api";
import { Leaf, Heart, MapPin, Plus, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { haversineDistance } from "@/lib/location";

interface CropCardProps {
  // A marketplace listing, or a crop on a farmer's profile with the farmer filled in.
  crop: Crop & { cropName?: string; category?: CropCategory; marketPrice?: number | null; farmer?: Partial<NonNullable<CropListing["farmer"]>> };
  categories: { name: string; emoji: string }[];
  getCropName: (crop: CropNameSource) => string;
  cart: Record<string, number>;
  addToCart: (cropId: string) => void;
  removeFromCart: (cropId: string) => void;
}

export default function CropCard({
  crop,
  categories,
  getCropName,
  cart,
  addToCart,
  removeFromCart,
}: CropCardProps) {
  const { user } = useAuth();
  // Real distance from the buyer's saved location to the farm; hidden if either is missing.
  const distanceKm = user?.latitude && user?.longitude && crop.farmLatitude && crop.farmLongitude
    ? haversineDistance(Number(user.latitude), Number(user.longitude), Number(crop.farmLatitude), Number(crop.farmLongitude))
    : null;
  const ratingCount = Number(crop.farmer?.ratingCount) || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
      <Link href={`/dashboard/buyer/crop/${crop.id}`}>
        <div className="h-40 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center text-4xl cursor-pointer">
          {/* Priority: Catalog Image > Farmer Image > Emoji */}
          {crop.catalog?.imageTemplate ? (
            <img src={crop.catalog.imageTemplate} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : crop.photos && crop.photos.length > 0 ? (
            <img src={crop.photos[0]} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <span>{categories.find(c => c.name.toUpperCase() === (crop.catalog?.category || crop.category))?.emoji || "🌾"}</span>
          )}
          
          {/* Overlays */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-[#1B5E20] flex items-center gap-1 shadow-sm">
            <Leaf className="w-3 h-3" /> Fresh
          </div>
          <div className="absolute top-3 right-3 w-7 h-7 bg-black/20 hover:bg-black/40 backdrop-blur rounded-full flex items-center justify-center text-white cursor-pointer transition-colors">
            <Heart className="w-4 h-4" />
          </div>
        </div>
      </Link>
      
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/dashboard/buyer/crop/${crop.id}`}>
          <h3 className="text-base font-bold text-[#212121] truncate cursor-pointer hover:text-[#1B5E20]">{getCropName(crop)}</h3>
        </Link>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{crop.farmer?.name}</p>
        
        <div className="flex items-center gap-1 mt-2">
          {ratingCount > 0 ? (
            <>
              <span className="text-[#FFC107]">★</span>
              <span className="text-xs font-bold text-[#212121]">{Number(crop.farmer?.rating).toFixed(1)}</span>
              <span className="text-[10px] text-gray-400">({ratingCount})</span>
            </>
          ) : (
            <span className="text-[10px] font-bold text-[#2E7D32] bg-green-50 px-1.5 py-0.5 rounded">New farmer</span>
          )}
        </div>
        
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            <p className="text-base font-black text-[#212121]">₹{(Number(crop.basePricePerKg) * 1.2).toFixed(2).replace(/\.00$/, '')} <span className="text-[10px] text-gray-500 font-normal">/ kg</span></p>
            <p className="text-[10px] font-bold text-[#2E7D32] mt-0.5">Avg Market: ₹{crop.marketPrice ? Math.floor(Number(crop.marketPrice)) : Math.floor(Number(crop.basePricePerKg) * 1.2)}/kg</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {distanceKm !== null && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                <MapPin className="w-3 h-3" /> {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km away
              </div>
            )}
            {cart[crop.id] ? (
              <div className="flex items-center gap-2 bg-green-50 rounded-lg p-1 border border-green-100">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFromCart(crop.id); }} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Minus size={14} /></button>
                <span className="text-xs font-bold text-[#1B5E20]">{cart[crop.id]}</span>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(crop.id); }} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Plus size={14} /></button>
              </div>
            ) : (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(crop.id); }} className="w-7 h-7 rounded bg-[#1B5E20] hover:bg-[#2E7D32] flex items-center justify-center text-white transition-colors shadow-sm">
                <Plus size={16} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
