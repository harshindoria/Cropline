"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, MapPin, CheckCircle2, Star, Package, Leaf, Users, Phone, Clock, MessageCircle, Loader2, ShoppingBasket, Edit3, ChevronDown, ChevronLeft, ChevronRight, X
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
  const [isClient, setIsClient] = useState(false);
  
  // Review States
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);
  const [reviewSort, setReviewSort] = useState<"highest" | "lowest">("highest");
  const [reviewPage, setReviewPage] = useState(1);
  const REVIEWS_PER_PAGE = 3;

  // New Review Modal States
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(0);
  const [newReviewComment, setNewReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleSubmitReview = async () => {
    if (newReviewRating === 0) return alert("Please select a rating");
    try {
      setIsSubmittingReview(true);
      const payload = {
        targetId: farmerId,
        targetType: "FARMER",
        rating: newReviewRating,
        comment: newReviewComment
      };
      const res = await api.post('/reviews', payload);
      if (res.data.success) {
        alert("Review submitted successfully!");
        setIsReviewModalOpen(false);
        window.location.reload(); 
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("cropline_cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("cropline_cart", JSON.stringify(cart));
    }
  }, [cart, isClient]);

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
        <div className="bg-white rounded-[24px] p-6 md:p-8 border border-gray-100 shadow-sm mt-8">
          <h2 className="text-xl font-black text-[#1B5E20]">Customer Reviews</h2>
          <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-8 mt-2"></div>

          {/* Top Review Stats Area */}
          <div className="flex flex-col md:flex-row gap-8 pb-8 border-b border-gray-100">
            {/* Overall Rating */}
            <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto md:pr-8 md:border-r border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-5xl font-black text-[#212121]">{farmer.rating ? farmer.rating.toFixed(1) : "0.0"}</span>
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-sm font-bold text-gray-800">Overall Rating</p>
              <p className="text-xs font-semibold text-[#2E7D32] mt-1">Based on {farmer.reviews?.totalCount || 0} reviews</p>
            </div>

            {/* Rating Bars */}
            <div className="flex-1 flex flex-col gap-2 justify-center">
              {[5, 4, 3, 2, 1].map((stars) => {
                const total = farmer.reviews?.totalCount || 0;
                // Mock distribution if exact data isn't available
                let count = 0;
                if (total > 0) {
                  if (stars === 5) count = Math.floor(total * 0.75);
                  else if (stars === 4) count = Math.floor(total * 0.18);
                  else if (stars === 3) count = Math.floor(total * 0.05);
                  else if (stars === 2) count = Math.floor(total * 0.01);
                  else if (stars === 1) count = total - Math.floor(total*0.75) - Math.floor(total*0.18) - Math.floor(total*0.05) - Math.floor(total*0.01);
                }
                const percent = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-8 shrink-0">
                      <span className="text-sm font-bold text-gray-600">{stars}</span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1B5E20] rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Call to Action */}
            <div className="shrink-0 bg-[#F9FAF7] rounded-2xl p-6 flex flex-col items-center justify-center border border-[#E8F5E9] w-full md:w-64">
              <p className="text-sm font-bold text-[#1B5E20] mb-2">Share your experience</p>
              <div className="flex text-yellow-400 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-yellow-400" />)}
              </div>
              <p className="text-[10px] font-semibold text-gray-500 mb-4 text-center">Your review helps other buyers!</p>
              <button 
                onClick={() => setIsReviewModalOpen(true)}
                className="w-full py-2 bg-white border border-[#2E7D32] text-[#2E7D32] rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-50 transition-colors shadow-sm"
              >
                <Edit3 className="w-4 h-4" />
                Write a Review
              </button>
            </div>
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 border-b border-gray-100">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              <button 
                onClick={() => { setReviewFilter(null); setReviewPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${reviewFilter === null ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                All Reviews
              </button>
              {[5, 4, 3, 2, 1].map(star => (
                <button 
                  key={star}
                  onClick={() => { setReviewFilter(star); setReviewPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-colors border ${reviewFilter === star ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  {star} <Star className={`w-3 h-3 ${reviewFilter === star ? 'fill-white text-white' : 'fill-yellow-400 text-yellow-400'}`} />
                </button>
              ))}
            </div>

            <div className="relative group shrink-0">
              <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">
                Sort: {reviewSort === "highest" ? "Highest Rating" : "Lowest Rating"} <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-lg rounded-lg py-1 w-36 hidden group-hover:block z-20">
                <button 
                  onClick={() => setReviewSort("highest")}
                  className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700"
                >
                  Highest Rating
                </button>
                <button 
                  onClick={() => setReviewSort("lowest")}
                  className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50 text-gray-700"
                >
                  Lowest Rating
                </button>
              </div>
            </div>
          </div>

          {/* Review List */}
          <div className="flex flex-col divide-y divide-gray-100">
            {(() => {
              const allReviews = farmer.reviews?.textReviews || [];
              const filteredReviews = reviewFilter 
                ? allReviews.filter((r: any) => Math.round(r.rating) === reviewFilter)
                : allReviews;
              const sortedReviews = [...filteredReviews].sort((a: any, b: any) => {
                if (reviewSort === "highest") return b.rating - a.rating;
                return a.rating - b.rating;
              });
              const totalReviewPages = Math.max(1, Math.ceil(sortedReviews.length / REVIEWS_PER_PAGE));
              const paginatedReviews = sortedReviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

              if (sortedReviews.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-500 font-medium text-sm">
                    No reviews found for the selected filters.
                  </div>
                );
              }

              return (
                <>
                  {paginatedReviews.map((review: any) => (
                    <div key={review.id} className="py-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {/* Avatar */}
                      <div className="flex items-center gap-3 sm:w-48 shrink-0">
                        <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-lg font-black text-[#1B5E20] shrink-0">
                          {review.reviewer?.name?.split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#212121]">{review.reviewer?.name || 'User'}</p>
                          <p className="text-[10px] font-bold text-[#2E7D32] flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                          </p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(review.rating) ? 'fill-current' : ''}`} />
                            ))}
                          </div>
                          <span className="text-gray-300">•</span>
                          <span className="text-[10px] font-semibold text-gray-400">
                            {new Date(review.createdAt || Date.now()).toLocaleDateString(undefined, { dateStyle: 'medium'})}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-600 leading-relaxed mb-3">
                          {review.comment}
                        </p>
                        <div className="inline-block px-3 py-1 bg-[#F9FAF7] border border-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold rounded-full">
                          Produce Item
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalReviewPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-8">
                      <button 
                        onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                        disabled={reviewPage === 1}
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-gray-600">
                        Page {reviewPage} of {totalReviewPages}
                      </span>
                      <button 
                        onClick={() => setReviewPage(p => Math.min(totalReviewPages, p + 1))}
                        disabled={reviewPage === totalReviewPages}
                        className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Footer Contact Bar */}
        <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm flex items-center justify-between gap-6 mt-8">
          <div className="flex flex-wrap items-center gap-8 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#2E7D32]" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="text-base font-black text-[#212121]">{farmer.phone || 'Not Provided'}</p>
              </div>
            </div>

            <div className="w-px h-10 bg-gray-100 hidden md:block"></div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#2E7D32]" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</p>
                <p className="text-base font-black text-[#212121] truncate max-w-[200px]">{location}</p>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Floating Checkout Bar */}
      {isClient && Object.keys(cart).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-500">{Object.keys(cart).length} item{Object.keys(cart).length > 1 ? 's' : ''} in basket</span>
            <span className="text-lg font-black text-[#1B5E20]">Ready to checkout</span>
          </div>
          <button 
            onClick={() => router.push('/dashboard/buyer')}
            className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <ShoppingBasket className="w-5 h-5" />
            View Basket
          </button>
        </div>
      )}

      {/* Write a Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#F9FAF7]">
              <h3 className="text-lg font-black text-[#1B5E20]">Write a Review</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Overall Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewReviewRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star 
                        className={`w-10 h-10 ${star <= newReviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} transition-colors`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Your Experience</label>
                <textarea 
                  rows={4}
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="Tell others about the quality of the produce, delivery experience, etc."
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] transition-all resize-none outline-none"
                />
              </div>

              <button 
                onClick={handleSubmitReview}
                disabled={isSubmittingReview || newReviewRating === 0}
                className="w-full py-4 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmittingReview ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
