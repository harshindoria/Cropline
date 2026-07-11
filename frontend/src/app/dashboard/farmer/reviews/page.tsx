"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Star, MessageSquare } from "lucide-react";
import Image from "next/image";

export default function FarmerReviewsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [reviewsData, setReviewsData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "FARMER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoadingData(true);
        const res = await api.get(`/reviews/me`);
        if (res.data.success) {
          setReviewsData(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch reviews", err);
      } finally {
        setLoadingData(false);
      }
    };
    if (user) {
      fetchReviews();
    }
  }, [user]);

  if (loading || loadingData) {
    return (
      <div className="h-full flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  if (!reviewsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-400">Failed to load reviews.</h2>
      </div>
    );
  }

  const totalReviews = reviewsData.totalCount || 1;
  const getPercent = (count: number) => Math.round((count / totalReviews) * 100);

  return (
    <div className="pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#212121]">My Ratings & Reviews</h1>
        <p className="text-gray-500 font-medium mt-1">See what buyers are saying about your crops.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
          {/* Left: Overall */}
          <div className="w-full md:w-1/3 flex flex-col items-center justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" stroke="#8BC34A" strokeWidth="8" 
                  strokeDasharray={`${(reviewsData.averageRating / 5) * 283} 283`} 
                  className="transition-all duration-[1500ms] ease-out drop-shadow-md" 
                  strokeLinecap="round" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-[#212121]">{reviewsData.averageRating}</span>
                <div className="flex gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={16} fill={star <= Math.round(reviewsData.averageRating) ? "#FFC107" : "transparent"} className={star <= Math.round(reviewsData.averageRating) ? "text-[#FFC107]" : "text-gray-300"} />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <h3 className="text-lg font-bold text-[#1B5E20]">Very Good</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">Based on {reviewsData.totalCount} global ratings</p>
            </div>
            
            <div className="mt-4 bg-[#F9FAF7] px-4 py-3 rounded-2xl w-full flex items-center gap-3 border border-green-50">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xl">👥</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#212121]">Happy customers</p>
                <p className="text-xs text-gray-500 font-medium">Thanks for your great service!</p>
              </div>
            </div>
          </div>

          {/* Right: Distribution */}
          <div className="w-full md:w-2/3 flex flex-col gap-4 pt-4">
            {[5, 4, 3, 2, 1].map((star, idx) => {
              const count = reviewsData.distribution[star as keyof typeof reviewsData.distribution] || 0;
              const percent = getPercent(count);
              return (
                <div key={star} className="flex items-center gap-4 text-sm group">
                  <div className="flex items-center gap-1.5 w-20 text-gray-600 font-bold shrink-0">
                    <Star size={16} className="text-[#1B5E20]" fill="currentColor" /> {star} Star
                  </div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                    <div 
                      className="h-full bg-gradient-to-r from-[#8BC34A] to-[#689F38] rounded-full transition-all duration-[1500ms] ease-out origin-left" 
                      style={{ width: `${percent}%`, transitionDelay: `${idx * 100}ms` }}
                    ></div>
                  </div>
                  <div className="w-12 text-right font-bold text-[#212121] shrink-0">{count}</div>
                  <div className="w-12 text-right font-bold text-gray-400 shrink-0">({percent}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Text Reviews List */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-black text-[#212121] mb-6 flex items-center gap-2">
          <MessageSquare size={20} className="text-[#1B5E20]" /> Buyer Reviews
        </h3>
        
        {reviewsData.textReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <MessageSquare className="text-gray-300" size={24} />
            </div>
            <p className="text-gray-400 font-medium">No written reviews yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsData.textReviews.map((review: any) => (
              <div key={review.id} className="border border-gray-100 p-5 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-[#1B5E20] font-black uppercase text-lg">
                    {review.reviewer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-[#212121]">{review.reviewer.name}</p>
                    <p className="text-xs font-medium text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={14} fill={star <= review.rating ? "#FFC107" : "transparent"} className={star <= review.rating ? "text-[#FFC107]" : "text-gray-300"} />
                  ))}
                  <span className="text-[10px] font-bold text-[#1B5E20] ml-2 uppercase tracking-wider bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                    {review.order?.crop?.cropName || review.order?.crop?.catalog?.name?.en || 'Crop'}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
