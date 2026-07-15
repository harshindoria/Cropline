"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, Search, MapPin, Star, BadgeCheck, Heart, ChevronDown, Package, LayoutGrid, ChevronLeft, ChevronRight, SlidersHorizontal, Map, Users, Leaf
} from "lucide-react";
import Image from "next/image";
import { INDIA_STATES } from "@/lib/india-locations";

export default function SuppliersDirectory() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  useEffect(() => {
    if (selectedState) {
      const stateObj = INDIA_STATES.find(s => s.name === selectedState);
      setAvailableDistricts(stateObj ? stateObj.districts : []);
      setSelectedDistrict("");
    } else {
      setAvailableDistricts([]);
      setSelectedDistrict("");
    }
  }, [selectedState]);

  const calculateExperience = (dateString?: string) => {
    if (!dateString) return 'Just Joined';
    const joined = new Date(dateString);
    const diffTime = Math.abs(new Date().getTime() - joined.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears < 1) {
      const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
      return diffMonths <= 0 ? 'Just Joined' : `${diffMonths} Month${diffMonths !== 1 ? 's' : ''}`;
    }
    return `${Math.floor(diffYears)}+ Years`;
  };

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
        
        if (selectedState) {
          endpoint += `&state=${encodeURIComponent(selectedState)}`;
        }

        if (selectedDistrict) {
          endpoint += `&district=${encodeURIComponent(selectedDistrict)}`;
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
  }, [user, searchQuery, selectedState, selectedDistrict]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  // Calculate stats from loaded suppliers
  const totalFarmers = suppliers.length;
  const activeFarmers = suppliers.filter(s => (s._count?.crops || s.crops?.length) > 0).length;
  const totalProducts = suppliers.reduce((acc, s) => acc + (s._count?.crops || s.crops?.length || 0), 0);
  const avgRating = suppliers.length > 0 ? (suppliers.reduce((acc, s) => acc + (s.rating || 0), 0) / suppliers.length).toFixed(1) : "0.0";
  const totalReviews = suppliers.reduce((acc, s) => acc + (s.ratingCount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#FAFBFA] font-[family-name:var(--font-poppins)]">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard/buyer")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[#1B5E20]">Farmers Directory</h1>
            <p className="text-sm font-semibold text-gray-500">Connect directly with verified farmers and explore their fresh produce.</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-[#2E7D32]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#212121]">{totalFarmers}</p>
                <p className="text-sm font-bold text-gray-800">Total Farmers</p>
                <p className="text-[10px] font-semibold text-gray-500">Across platform</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                <BadgeCheck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#212121]">{activeFarmers}</p>
                <p className="text-sm font-bold text-gray-800">Active Farmers</p>
                <p className="text-[10px] font-semibold text-gray-500">Currently selling</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#212121]">{totalProducts}</p>
                <p className="text-sm font-bold text-gray-800">Total Products</p>
                <p className="text-[10px] font-semibold text-gray-500">Listed by farmers</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#212121]">{avgRating}</p>
                <p className="text-sm font-bold text-gray-800">Avg. Rating</p>
                <p className="text-[10px] font-semibold text-gray-500">From {totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                placeholder="Search by farmer name, village or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 focus:border-[#2E7D32] rounded-xl outline-none text-sm font-semibold transition-all shadow-sm"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                  <LayoutGrid size={16} className="text-gray-500" /> All Categories <ChevronDown size={14} className="text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                  <Leaf size={16} className="text-gray-500" /> All Crops <ChevronDown size={14} className="text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                  <BadgeCheck size={16} className="text-gray-500" /> All Status <ChevronDown size={14} className="text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                  <SlidersHorizontal size={16} className="text-gray-500" /> More Filters
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="appearance-none flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm pr-8 outline-none focus:border-[#2E7D32]"
                  >
                    <option value="">All States</option>
                    {INDIA_STATES.map((state) => (
                      <option key={state.name} value={state.name}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedState}
                    className="appearance-none flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm pr-8 outline-none focus:border-[#2E7D32] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Districts</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Suppliers Grid */}
          {loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-80 border border-gray-100 shadow-sm animate-pulse"></div>
              ))}
            </div>
          ) : suppliers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {suppliers.map(farmer => (
                <div key={farmer.id} className="bg-white rounded-[20px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col relative pb-4">
                  
                  {/* Background Cover Image */}
                  <div 
                    className="h-28 w-full bg-cover bg-center"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop')" }}
                  >
                    {/* Overlays */}
                    <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-md text-[10px] font-black text-[#1B5E20] flex items-center gap-1 shadow-sm">
                      Verified
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 bg-white/50 backdrop-blur rounded-full flex items-center justify-center text-gray-700 cursor-pointer hover:bg-white transition-colors shadow-sm">
                      <Heart className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Circular Avatar */}
                  <div className="flex justify-center -mt-12 relative z-10 mb-2">
                    <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-sm flex items-center justify-center">
                      <div className="w-full h-full bg-gradient-to-br from-[#1B5E20] to-emerald-400 flex items-center justify-center text-white font-black text-3xl">
                        {farmer.name ? farmer.name.charAt(0).toUpperCase() : "F"}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-col items-center px-4 flex-1">
                    <h3 className="text-lg font-black text-[#212121] text-center">{farmer.name}</h3>
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="text-gray-400" />
                      {farmer.village ? `${farmer.village}, ` : ''}{farmer.district || 'Unknown Location'}
                    </p>

                    <div className="flex items-center gap-1.5 mt-3 text-sm">
                      <Star className="text-yellow-400 fill-yellow-400" size={14} />
                      <span className="font-black text-[#212121]">{farmer.rating ? farmer.rating.toFixed(1) : "0.0"}</span>
                      <span className="font-semibold text-gray-400">({farmer.ratingCount || 0})</span>
                      <span className="text-gray-300 mx-1">•</span>
                      <span className="font-semibold text-gray-500 text-xs">{calculateExperience(farmer.createdAt)}</span>
                    </div>

                    <div className="mt-3">
                      {farmer.categories && farmer.categories.length > 0 ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                          {farmer.categories[0]}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                          Vegetables
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between w-full mt-5 px-2 text-xs font-bold text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Package size={14} className="text-gray-400" />
                        {farmer._count?.crops ?? farmer.crops?.length ?? 0} Products
                      </div>
                      <div className="flex items-center gap-1.5">
                        <LayoutGrid size={14} className="text-gray-400" />
                        {farmer.farmArea ?? 0} Acres
                      </div>
                    </div>

                    <div className="w-full mt-5">
                      <button 
                        onClick={() => router.push(`/dashboard/buyer/farmer/${farmer.id}`)}
                        className="w-full py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        View Profile
                      </button>
                    </div>
                  </div>

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
              {(searchQuery || selectedState || selectedDistrict) && (
                <button 
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedState("");
                    setSelectedDistrict("");
                  }}
                  className="mt-6 px-6 py-2 bg-green-50 text-[#1B5E20] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-green-100 transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loadingData && suppliers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-100 gap-4">
              <p className="text-sm font-semibold text-gray-600">
                Showing 1 to {Math.min(12, suppliers.length)} of {totalFarmers || 236} farmers
              </p>
              
              <div className="flex items-center gap-2">
                <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                  <ChevronLeft size={16} />
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1B5E20] text-white font-bold text-sm shadow-sm">
                  1
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50">
                  2
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50">
                  3
                </button>
                <span className="w-9 h-9 flex items-center justify-center text-gray-400">...</span>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50">
                  20
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
