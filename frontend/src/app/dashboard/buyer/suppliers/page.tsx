"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, Search, MapPin, Star, BadgeCheck, Leaf, ChevronRight, X
} from "lucide-react";
import Image from "next/image";

export default function SuppliersDirectory() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [isNearMe, setIsNearMe] = useState(false);
  const [maxDistance, setMaxDistance] = useState(50);
  
  // Selected Profile Modal
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoadingData(true);
        let endpoint = `/suppliers?limit=50`;
        
        if (searchQuery.trim()) {
          endpoint += `&search=${encodeURIComponent(searchQuery)}`;
        }
        
        if (isNearMe && user?.latitude && user?.longitude) {
          endpoint += `&lat=${user.latitude}&lng=${user.longitude}&radius=${maxDistance}`;
        }

        const res = await api.get(endpoint);
        if (res.data.success) {
          setSuppliers(res.data.data.suppliers || []);
        }
      } catch (err) {
        console.error("Failed to fetch suppliers", err);
      } finally {
        setLoadingData(false);
      }
    };

    if (user && user.activeRole === "BUYER") {
      fetchSuppliers();
    }
  }, [user, searchQuery, isNearMe, maxDistance]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex flex-col text-[#212121] font-[family-name:var(--font-poppins)]">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dashboard/buyer")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#1B5E20]">Farmers Directory</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Connect directly with growers</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:py-8 w-full flex-1 flex flex-col gap-6">
        
        {/* Filters Section */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by farmer name, village or district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-200 focus:bg-white rounded-2xl outline-none text-sm font-semibold transition-all"
            />
          </div>

          <div className="h-px md:h-10 w-full md:w-px bg-gray-100"></div>

          {/* Location Proximity Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:w-auto">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 relative ${isNearMe ? 'bg-[#1B5E20]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isNearMe ? 'translate-x-4' : 'translate-x-0'}`}></div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={isNearMe}
                  onChange={(e) => setIsNearMe(e.target.checked)}
                />
              </div>
              <span className="text-xs font-black text-gray-600 uppercase group-hover:text-[#1B5E20] transition-colors">
                📍 Farmers Near Me
              </span>
            </label>

            {isNearMe && (
              <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl">
                <input 
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(Number(e.target.value))}
                  className="w-24 md:w-32 accent-[#1B5E20] h-1.5 bg-green-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-black text-[#1B5E20] whitespace-nowrap w-12">
                  {maxDistance} km
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Suppliers Grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl h-64 border border-gray-100 animate-pulse"></div>
            ))}
          </div>
        ) : suppliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.map(farmer => (
              <div key={farmer.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                
                {/* Card Header (Farmer Info) */}
                <div 
                  onClick={() => router.push(`/dashboard/buyer/farmer/${farmer.id}`)}
                  className="p-5 flex gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1B5E20] to-emerald-400 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-inner">
                    {farmer.name ? farmer.name.charAt(0).toUpperCase() : "F"}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-black text-[#1B5E20] hover:underline flex items-center gap-1.5">
                          {farmer.name}
                          {farmer.isVerified && <BadgeCheck className="text-blue-500" size={16} />}
                        </h3>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <MapPin size={10} />
                          {farmer.village ? `${farmer.village}, ` : ''}{farmer.district || 'Unknown Location'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md">
                        <Star className="text-yellow-500 fill-yellow-500" size={12} />
                        <span className="text-xs font-black text-yellow-700">{farmer.rating ? farmer.rating.toFixed(1) : "New"}</span>
                      </div>
                      {farmer.distanceKm !== null && (
                        <div className="text-[10px] font-bold text-[#1B5E20] bg-green-50 px-2 py-0.5 rounded-md">
                          {Math.round(farmer.distanceKm)} km away
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badges/Categories */}
                <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                  {farmer.categories && farmer.categories.length > 0 ? (
                    farmer.categories.map((cat: string) => (
                      <span key={cat} className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Diverse Crops</span>
                  )}
                </div>

                {/* Active Listings Preview */}
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active Produce</p>
                    <span className="text-[10px] font-bold text-[#1B5E20]">{farmer.crops?.length || 0} items</span>
                  </div>
                  
                  {farmer.crops && farmer.crops.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {farmer.crops.map((crop: any) => (
                        <div 
                          key={crop.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/buyer/crop/${crop.id}`);
                          }}
                          className="w-16 shrink-0 bg-white p-1 rounded-xl shadow-xs border border-gray-100 cursor-pointer hover:border-green-300 transition-colors"
                        >
                          <div className="w-full h-12 relative rounded-lg overflow-hidden bg-gray-100 mb-1">
                            {crop.photos && crop.photos[0] ? (
                              <Image src={crop.photos[0]} alt="Crop" fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Leaf size={14} className="text-gray-300" /></div>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-center truncate">{crop.catalog.englishName}</p>
                          <p className="text-[9px] font-black text-[#1B5E20] text-center">₹{crop.basePricePerKg}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs font-semibold text-gray-400">
                      No active listings right now
                    </div>
                  )}
                </div>

                {/* View Profile Action */}
                <button 
                  onClick={() => router.push(`/dashboard/buyer/farmer/${farmer.id}`)}
                  className="w-full py-3.5 bg-white border-t border-gray-100 text-xs font-black text-[#1B5E20] hover:bg-green-50 transition-colors flex items-center justify-center gap-1 group/btn"
                >
                  View Farm Profile <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Search className="text-gray-300 w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-[#212121]">No farmers found</h2>
            <p className="text-sm font-semibold text-gray-500 mt-1 max-w-md text-center">
              Try adjusting your search filters or increasing the proximity radius to discover more growers.
            </p>
            {(searchQuery || isNearMe) && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setIsNearMe(false);
                }}
                className="mt-6 px-6 py-2 bg-green-50 text-[#1B5E20] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-green-100 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Farmer Detail Modal */}
      {selectedFarmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gradient-to-br from-green-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1B5E20] to-emerald-400 flex items-center justify-center text-white font-black text-2xl shadow-inner">
                  {selectedFarmer.name ? selectedFarmer.name.charAt(0).toUpperCase() : "F"}
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#212121] flex items-center gap-2">
                    {selectedFarmer.name}
                    {selectedFarmer.isVerified && <BadgeCheck className="text-blue-500" size={20} />}
                  </h2>
                  <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={12} />
                    {selectedFarmer.village ? `${selectedFarmer.village}, ` : ''}{selectedFarmer.district}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFarmer(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Trust Card */}
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Star size={12} className="fill-emerald-800" /> Supplier Rating
                  </span>
                  <span className="text-sm font-black text-emerald-900">{selectedFarmer.rating ? selectedFarmer.rating.toFixed(1) : "New"} / 5.0</span>
                </div>
                <p className="text-[10px] font-semibold text-emerald-700">
                  Based on {selectedFarmer.ratingCount || 0} verified buyer reviews.
                </p>
              </div>

              {/* Produce Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-[#212121]">Active Listings</h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{selectedFarmer.crops?.length || 0} Crops</span>
                </div>

                {selectedFarmer.crops && selectedFarmer.crops.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedFarmer.crops.map((crop: any) => (
                      <div 
                        key={crop.id}
                        onClick={() => router.push(`/dashboard/buyer/crop/${crop.id}`)}
                        className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm hover:border-[#1B5E20] transition-colors cursor-pointer group"
                      >
                        <div className="w-full h-24 relative rounded-xl overflow-hidden bg-gray-100 mb-2">
                          {crop.photos && crop.photos[0] ? (
                            <Image src={crop.photos[0]} alt="Crop" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Leaf size={20} className="text-gray-300" /></div>
                          )}
                        </div>
                        <div className="px-1">
                          <p className="text-xs font-bold text-[#212121] truncate">{crop.catalog.englishName}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-black text-[#1B5E20]">₹{crop.basePricePerKg}</span>
                            <span className="text-[9px] font-bold text-gray-500">{crop.quantityRemainingKg} kg left</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                    <Leaf className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-500">This farmer has no active crops listed at the moment.</p>
                  </div>
                )}
              </div>

              {/* Message Banner */}
              <div className="bg-[#212121] text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <h3 className="text-sm font-black mb-1">Have a custom requirement?</h3>
                <p className="text-[10px] text-gray-400 font-semibold mb-4 w-4/5">Chat directly with {selectedFarmer.name.split(' ')[0]} to negotiate bulk rates or ask for specific produce.</p>
                <button className="px-4 py-2 bg-white text-[#212121] text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-gray-100 transition-colors cursor-pointer w-max">
                  Message Farmer
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
