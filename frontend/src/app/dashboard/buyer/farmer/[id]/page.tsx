"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { ArrowLeft, Star, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";

export default function FarmerPublicProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const farmerId = params.id as string;

  const [farmer, setFarmer] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

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

  if (loading || loadingData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="min-h-screen bg-[#FAFBFA] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-700">Farmer Not Found</h2>
        <button onClick={() => router.back()} className="mt-4 px-6 py-2 bg-[#1B5E20] text-white rounded-lg font-bold">Go Back</button>
      </div>
    );
  }

  // Calculate percentages for distribution
  const totalReviews = farmer.reviews.totalCount || 1; // avoid division by zero
  const getPercent = (count: number) => Math.round((count / totalReviews) * 100);

  return (
    <div className="min-h-screen bg-[#F9FAF7] font-[family-name:var(--font-poppins)] pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-[#212121]">Farmer Profile</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-4xl border-4 border-green-50 shrink-0">
            👨‍🌾
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl font-black text-[#212121] flex items-center justify-center md:justify-start gap-2">
              {farmer.name} <ShieldCheck size={20} className="text-blue-500" />
            </h2>
            <p className="text-gray-500 font-medium flex items-center justify-center md:justify-start gap-1.5 mt-2">
              <MapPin size={16} /> {farmer.village}, {farmer.district}, {farmer.state}
            </p>
            <p className="text-sm font-bold text-[#1B5E20] mt-1 bg-green-50 inline-block px-3 py-1 rounded-full">
              Farm Area: {farmer.farmArea ?? "Not Specified"} Acres
            </p>
          </div>
          <div className="bg-[#FAFBFA] p-4 rounded-2xl border border-gray-100 text-center shrink-0 min-w-[120px]">
            <div className="flex items-center justify-center gap-1 text-[#FFC107] mb-1">
              <Star size={24} fill="currentColor" />
              <span className="text-2xl font-black text-[#212121]">{farmer.rating || "0.0"}</span>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{farmer.ratingCount} Ratings</p>
          </div>
        </div>

        {/* Active Crops */}
        <div>
          <h3 className="text-lg font-black text-[#212121] mb-4">Active Crops</h3>
          {farmer.activeCrops.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center text-gray-400">
              No active crops listed.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {farmer.activeCrops.map((crop: any) => (
                <div key={crop.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/dashboard/buyer/crop/${crop.id}`)}>
                  <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 relative border border-gray-100">
                    {crop.photos?.[0] ? (
                      <Image src={crop.photos[0]} alt="Crop" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🌾</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#212121]">{crop.catalog?.englishName || "Crop"}</h4>
                    <p className="text-sm text-gray-500 mt-1">{crop.quantityRemainingKg || crop.availableQuantityKg || 0} kg available</p>
                    <p className="font-black text-[#1B5E20] mt-1">₹{crop.basePricePerKg}/kg</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ratings & Reviews */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-[#212121] mb-6">Ratings & Reviews</h3>
          
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
            {/* Left: Overall */}
            <div className="w-full md:w-1/3 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#8BC34A" strokeWidth="8" strokeDasharray={`${(farmer.rating / 5) * 283} 283`} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-[#212121]">{farmer.rating || "0.0"}</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={14} fill={star <= Math.round(farmer.rating) ? "#FFC107" : "transparent"} className={star <= Math.round(farmer.rating) ? "text-[#FFC107]" : "text-gray-300"} />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mt-4">Based on {farmer.reviews.totalCount} ratings</p>
            </div>

            {/* Right: Distribution */}
            <div className="w-full md:w-2/3 flex flex-col gap-3">
              {[5, 4, 3, 2, 1].map(star => {
                const count = farmer.reviews.distribution[star as keyof typeof farmer.reviews.distribution] || 0;
                const percent = getPercent(count);
                return (
                  <div key={star} className="flex items-center gap-3 text-sm group">
                    <div className="flex items-center gap-1 w-16 text-gray-600 font-bold shrink-0">
                      {star} <Star size={14} className="text-gray-400 group-hover:text-[#FFC107] transition-colors" />
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#8BC34A] rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <div className="w-10 text-right font-bold text-gray-500 shrink-0">{percent}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Text Reviews List */}
          <div className="mt-10 space-y-6">
            <h4 className="text-lg font-bold text-[#212121] border-b border-gray-100 pb-4">Customer Reviews</h4>
            {farmer.reviews.textReviews.length === 0 ? (
              <p className="text-gray-400 text-center py-4 font-medium">No text reviews yet.</p>
            ) : (
              farmer.reviews.textReviews.map((review: any) => (
                <div key={review.id} className="border-b border-gray-50 pb-6 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[#1B5E20] font-bold uppercase">
                      {review.reviewer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-[#212121] text-sm">{review.reviewer.name}</p>
                      <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={12} fill={star <= review.rating ? "#FFC107" : "transparent"} className={star <= review.rating ? "text-[#FFC107]" : "text-gray-300"} />
                    ))}
                    <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-full">
                      Purchased: {review.order?.crop?.cropName || review.order?.crop?.catalog?.name?.en || 'Crop'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
