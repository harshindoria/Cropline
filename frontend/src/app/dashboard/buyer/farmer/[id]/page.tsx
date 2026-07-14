"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, MapPin, CheckCircle2, Star, Package, Leaf, Users, Phone, Clock, MessageCircle, Loader2
} from "lucide-react";
import Image from "next/image";
import CropCard from "../../components/CropCard";

const categories = [
  { name: "Grains", emoji: "🌾" },
  { name: "Vegetables", emoji: "🥬" },
  { name: "Fruits", emoji: "🍎" },
  { name: "Pulses", emoji: "🫘" },
  { name: "Oilseeds", emoji: "🥜" },
];

export default function FarmerPublicProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const farmerId = params.id as string;

  const [farmer, setFarmer] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});

  const addToCart = (cropId: string, minOrder: number = 5) => {
    setCart(prev => ({
      ...prev,
      [cropId]: prev[cropId] ? prev[cropId] + minOrder : minOrder
    }));
  };

  const removeFromCart = (cropId: string, minOrder: number = 5) => {
    setCart(prev => {
      const copy = { ...prev };
      if (copy[cropId] <= minOrder) {
        delete copy[cropId];
      } else {
        copy[cropId] -= minOrder;
      }
      return copy;
    });
  };

  const getCropName = (crop: any) => {
    return crop.cropName || crop.catalog?.englishName || "Crop";
  };

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingData(true);
        const res = await api.get(`/users/farmer/${farmerId}/public`);
        if (res.data.success) {
          setFarmer(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch farmer profile", err);
      } finally {
        setLoadingData(false);
      }
    };
    if (user && farmerId) {
      fetchProfile();
    }
  }, [user, farmerId]);

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

  if (loading || loadingData) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#F9FAF7]">
        <Loader2 className="w-8 h-8 text-[#2E7D32] animate-spin" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="h-full bg-[#FAFBFA] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-700">Farmer Not Found</h2>
        <button onClick={() => router.back()} className="mt-4 px-6 py-2 bg-[#1B5E20] text-white rounded-lg font-bold">Go Back</button>
      </div>
    );
  }

  const location = [farmer.district, farmer.state].filter(Boolean).join(', ') || 'Not Provided';
  const tags = [farmer.primaryCrops, farmer.farmingType, farmer.soilType].filter(Boolean).map((t: string) => t.split(',')).flat().map((t: string) => t.trim()).filter(Boolean);

  return (
    <div className="h-full overflow-y-auto bg-[#FDFDFD] font-[family-name:var(--font-poppins)] pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center gap-4 sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-[#212121]">Farmer Profile</h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6 relative z-10">
        
        {/* Hero Section */}
        <div className="relative w-full h-[240px] md:h-[280px] rounded-[32px] overflow-hidden shadow-sm">
          {/* Background Field Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=1200&q=80')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent" />
          
          <div className="relative z-10 h-full flex flex-col md:flex-row md:items-center px-6 md:px-10 gap-6 py-6 md:py-0">
            {/* Farmer Avatar */}
            <div className="relative shrink-0 w-28 h-28 md:w-40 md:h-40 mx-auto md:mx-0">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-xl bg-white flex items-center justify-center bg-gray-100">
                <span className="text-4xl font-bold text-gray-300">{farmer.name.charAt(0)}</span>
              </div>
              {farmer.isVerified && (
                <div className="absolute top-0 right-0 md:top-2 md:right-2 w-8 h-8 bg-[#2E7D32] rounded-full border-[3px] border-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Farmer Details */}
            <div className="space-y-2 md:space-y-3 md:pt-4 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-[#1B5E20]">{farmer.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-2 text-gray-700 font-semibold text-base md:text-lg">
                <MapPin className="w-5 h-5 text-gray-400" />
                {location}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 pt-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                  <Leaf className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span className="text-[11px] font-bold text-[#2E7D32]">{calculateExperience(farmer.createdAt)} on CropLine</span>
                </div>
              </div>
            </div>

            {/* Verified Badge Right Aligned (Hidden on small screens) */}
            {farmer.isVerified && (
              <div className="hidden md:block absolute right-10 bottom-10">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-gray-100">
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
                  <span className="text-sm font-bold text-gray-700">Verified Farmer</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 rounded-full flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 md:w-6 md:h-6 text-[#2E7D32]" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-[#1B5E20]">{farmer.activeCrops?.length || 0}</p>
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 leading-tight">Crops Listed</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-[#1B5E20]">0</p>
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 leading-tight">Orders Completed</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-[#1B5E20]">{farmer.rating?.toFixed(1) || '0.0'}</p>
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 leading-tight">Average Rating</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 rounded-full flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-[#1B5E20]">{farmer.reviews?.totalCount || 0}</p>
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 leading-tight">Happy Customers</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout: About & Top Crops */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
          {/* About Section */}
          <div className="bg-white rounded-[24px] p-6 md:p-8 border border-gray-100 shadow-sm h-fit">
            <h2 className="text-lg font-black text-[#1B5E20] mb-2">About {farmer.name.split(' ')[0]}</h2>
            <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-6"></div>
            
            <p className="text-sm font-medium text-gray-600 leading-relaxed mb-8 whitespace-pre-wrap">
              {farmer.aboutMe || 'No description provided.'}
            </p>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string, i: number) => (
                <span key={i} className="px-3 py-1.5 bg-green-50 text-[#2E7D32] text-xs font-bold rounded-lg border border-green-100">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Top Crops Section */}
          <div className="bg-white rounded-[24px] p-6 md:p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-black text-[#1B5E20]">Active Produce</h2>
            </div>
            <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-6"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {farmer.activeCrops?.map((crop: any) => (
                <CropCard 
                  key={crop.id}
                  crop={{ ...crop, farmer: { id: farmer.id, name: farmer.name, rating: farmer.rating, ratingCount: farmer.reviews?.totalCount || 0 } }}
                  categories={categories}
                  getCropName={getCropName}
                  cart={cart}
                  addToCart={(id) => addToCart(id)}
                  removeFromCart={(id) => removeFromCart(id)}
                />
              ))}
              {(!farmer.activeCrops || farmer.activeCrops.length === 0) && (
                <div className="col-span-full text-center py-8 text-gray-500 font-medium">
                  No crops listed yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="bg-white rounded-[24px] p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black text-[#1B5E20]">Customer Reviews</h2>
          </div>
          <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-8"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {farmer.reviews?.textReviews?.map((review: any) => (
              <div key={review.id} className="flex gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 bg-green-100 text-green-700`}>
                  {review.reviewer?.name?.charAt(0) || 'U'}
                </div>
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between w-full">
                    <p className="font-bold text-sm text-gray-800 truncate pr-2">{review.reviewer?.name || 'User'}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < Math.floor(review.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{review.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-500 leading-relaxed line-clamp-3">
                    {review.comment}
                  </p>
                </div>
              </div>
            ))}
            {(!farmer.reviews?.textReviews || farmer.reviews.textReviews.length === 0) && (
              <div className="col-span-full text-center py-4 text-gray-500 font-medium">
                No reviews yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Contact Bar */}
        <div className="bg-white rounded-[24px] p-4 md:p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 md:gap-12 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-gray-700">{farmer.phone || 'Not Provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</p>
                <p className="text-sm font-semibold text-gray-700 truncate max-w-[120px] md:max-w-none">{location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Available</p>
                <p className="text-sm font-semibold text-gray-700">6 AM - 8 PM</p>
              </div>
            </div>
          </div>

          <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2E7D32] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1B5E20] transition-colors shadow-sm shrink-0">
            <MessageCircle className="w-5 h-5" />
            Message Farmer
          </button>
        </div>

      </main>
    </div>
  );
}
