'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Star, Smile, FileText, Clock, ThumbsUp, ChevronDown, Trophy, Package, MessageSquare, CheckCircle, AlertCircle, Leaf } from 'lucide-react';
import api from '@/lib/axios';

export default function DeliveryReviews() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [reviewsData, setReviewsData] = useState<{
    averageRating: number;
    totalCount: number;
    distribution: Record<number, number>;
    textReviews: any[];
  } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== 'DELIVERY')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.activeRole === 'DELIVERY') {
      fetchReviews();
    }
  }, [user]);

  const fetchReviews = async () => {
    setFetching(true);
    try {
      const res = await api.get('/reviews/me');
      if (res.data.success) {
        setReviewsData(res.data.data);
      } else {
        setError(res.data.message || 'Failed to fetch reviews');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch reviews');
    } finally {
      setFetching(false);
    }
  };

  if (loading || fetching) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div></div>;

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      </div>
    );
  }

  const { averageRating = 0, totalCount = 0, distribution = {1:0, 2:0, 3:0, 4:0, 5:0}, textReviews = [] } = reviewsData || {};
  
  // Calculate positive ratings % (4 and 5 stars)
  const positiveCount = (distribution[4] || 0) + (distribution[5] || 0);
  const positivePercentage = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;

  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 24) return `${diffHrs || 1} hours ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return `1 day ago`;
    return `${diffDays} days ago`;
  };

  const renderStars = (rating: number, size = 16) => {
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        size={size} 
        className={i < Math.round(rating) ? "text-[#FF8F00] fill-[#FF8F00]" : "text-gray-200 fill-gray-200"} 
      />
    ));
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFDFD]">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 bg-white shrink-0">
        <h1 className="text-2xl font-black text-[#212121]">Ratings & Reviews</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">See what your customers think about your deliveries</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#F9FAF7] p-8">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Top Row: 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Average Rating Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-4">
                <Star size={40} className="text-[#1B5E20] fill-[#1B5E20]" />
              </div>
              <h2 className="text-5xl font-black text-[#212121] mb-2">{averageRating.toFixed(1)}</h2>
              <p className="text-sm font-bold text-gray-500 mb-6">out of 5</p>
              
              <div className="bg-[#E8F5E9] text-[#1B5E20] px-4 py-1.5 rounded-full text-sm font-black mb-4">
                Great Job!
              </div>
              <p className="text-sm font-semibold text-gray-400">{totalCount} total ratings</p>
            </div>

            {/* Rating Breakdown Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-center">
              <h3 className="text-sm font-black text-[#212121] mb-6">Rating Breakdown</h3>
              
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star] || 0;
                  const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-4 text-sm font-semibold text-gray-600">
                      <div className="flex items-center gap-1 w-16">
                        {star} Star
                      </div>
                      <div className="flex gap-1">
                        {renderStars(star, 12)}
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#FF8F00] rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-gray-400">
                        {percentage}% <span className="text-[10px]">({count})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-center space-y-6">
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                  <Smile size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#212121]">{positivePercentage}%</p>
                  <p className="text-xs font-bold text-gray-500">Positive Ratings</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <FileText size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#212121]">{totalCount}</p>
                  <p className="text-xs font-bold text-gray-500">Total Ratings</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Clock size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#212121]">{totalCount}</p> {/* Assuming 1 rating per delivery for now */}
                  <p className="text-xs font-bold text-gray-500">Deliveries Rated</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <ThumbsUp size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xl font-black text-[#212121]">{averageRating.toFixed(1)}</p>
                  <p className="text-xs font-bold text-gray-500">Average Rating</p>
                </div>
              </div>
            </div>
            
          </div>

          {/* Bottom Row: Reviews & Tips */}
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Customer Reviews List */}
            <div className="flex-1 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
                <h3 className="text-lg font-black text-[#212121]">Customer Reviews</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-sm font-bold text-gray-600 rounded-xl border border-gray-200">
                  Most Recent <ChevronDown size={16} />
                </button>
              </div>

              {textReviews.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare size={40} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-semibold">No text reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {textReviews.map((review) => {
                    const initials = review.reviewer?.name 
                      ? review.reviewer.name.substring(0, 1).toUpperCase()
                      : '?';
                    const colors = ['bg-purple-100 text-purple-700', 'bg-red-100 text-red-700', 'bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-green-100 text-green-700'];
                    const colorClass = colors[review.rating - 1] || colors[0];

                    return (
                      <div key={review.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${colorClass}`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#212121]">{review.reviewer?.name || 'Customer'}</p>
                            <p className="text-xs font-bold text-gray-400 mt-1">Order #{review.orderId.substring(0,8).toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex">{renderStars(review.rating, 16)}</div>
                          <span className="text-sm font-black text-[#1B5E20] ml-2">{review.rating.toFixed(1)}</span>
                        </div>

                        <div className="flex-1 min-w-[250px]">
                          <p className="text-sm font-semibold text-gray-700">"{review.comment}"</p>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <p className="text-xs font-bold text-gray-400">{timeAgo(review.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {textReviews.length >= 5 && (
                     <div className="flex justify-center mt-6">
                       <button className="flex items-center gap-2 px-6 py-3 bg-gray-50 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                         Load More Reviews <ChevronDown size={16} />
                       </button>
                     </div>
                  )}
                </div>
              )}
            </div>

            {/* Keep It Up & Tips */}
            <div className="w-full lg:w-[340px] shrink-0 space-y-6">
              
              {/* Trophy Card */}
              <div className="bg-[#F9FAF7] rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-center mb-6 mt-4">
                  <div className="relative">
                    <Trophy size={64} className="text-[#FFC107] fill-[#FFC107]" />
                    <div className="absolute -left-4 top-4 text-green-500"><Leaf size={24} /></div>
                    <div className="absolute -right-4 top-4 text-green-500"><Leaf size={24} /></div>
                  </div>
                </div>
                
                <h3 className="text-lg font-black text-[#212121] flex items-center gap-2 mb-2">
                  Keep It Up! <Leaf size={18} className="text-green-500" />
                </h3>
                <p className="text-sm font-medium text-gray-600 leading-relaxed">
                  You're doing great! Continue delivering excellent service to earn more 5-star ratings.
                </p>
              </div>

              {/* Tips Card */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-[#212121] mb-6">Tips to Improve Ratings</h3>
                
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <Clock size={14} className="text-[#1B5E20]" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 mt-1">Be on time for deliveries</p>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-[#1B5E20]" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 mt-1">Handle items with care</p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <MessageSquare size={14} className="text-[#1B5E20]" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 mt-1">Be polite and communicate</p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <CheckCircle size={14} className="text-[#1B5E20]" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 mt-1">Follow delivery instructions</p>
                  </div>
                </div>

                <button className="w-full mt-8 py-3 text-sm font-bold text-[#1B5E20] border-2 border-[#1B5E20] rounded-xl hover:bg-green-50 transition-colors flex items-center justify-center gap-2">
                  View Full Guide <span>→</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
