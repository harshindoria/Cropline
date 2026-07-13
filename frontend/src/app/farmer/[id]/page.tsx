'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  MapPin, 
  CheckCircle2, 
  Star, 
  Package, 
  Leaf, 
  Users, 
  Phone, 
  Clock,
  MessageCircle,
  Search,
  ChevronRight,
  Loader2
} from 'lucide-react';
import api from '@/lib/axios';

export default function FarmerProfilePage({ params }: { params: { id: string } }) {
  const [farmer, setFarmer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarmer();
  }, []);

  const fetchFarmer = async () => {
    try {
      const res = await api.get(`/users/farmer/${params.id}/public`);
      if (res.data.success) {
        setFarmer(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]"><Loader2 className="w-8 h-8 text-[#2E7D32] animate-spin" /></div>;
  if (!farmer) return <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">Farmer not found</div>;

  const location = [farmer.district, farmer.state].filter(Boolean).join(', ') || 'Not Provided';
  const tags = [farmer.primaryCrops, farmer.farmingType, farmer.soilType].filter(Boolean).map(t => t.split(',')).flat().map(t => t.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-[family-name:var(--font-poppins)]">
      
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-[#2E7D32]" />
            <span className="text-xl font-black text-[#1B5E20] tracking-tight">CROPLINE</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-600">
            <Link href="/" className="hover:text-[#2E7D32] transition-colors">Home</Link>
            <Link href="/browse" className="hover:text-[#2E7D32] transition-colors">Browse Crops</Link>
            <Link href="/about" className="hover:text-[#2E7D32] transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-[#2E7D32] transition-colors">Contact</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search crops, farmers..." 
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 w-64 transition-shadow"
            />
          </div>
          <button className="flex items-center gap-2 bg-[#2E7D32] text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-[#1B5E20] transition-colors shadow-sm">
            <MessageCircle className="w-4 h-4" />
            Connect
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        
        {/* Hero Section */}
        <div className="relative w-full h-[280px] rounded-[32px] overflow-hidden shadow-sm">
          {/* Background Field Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=1200&q=80')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent" />
          
          <div className="relative z-10 h-full flex items-center px-10 gap-8">
            {/* Farmer Avatar */}
            <div className="relative shrink-0">
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white flex items-center justify-center bg-gray-100">
                <span className="text-4xl font-bold text-gray-300">{farmer.name.charAt(0)}</span>
              </div>
              {farmer.isVerified && (
                <div className="absolute top-2 right-2 w-8 h-8 bg-[#2E7D32] rounded-full border-[3px] border-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Farmer Details */}
            <div className="space-y-3 pt-4">
              <h1 className="text-4xl font-black text-[#1B5E20]">{farmer.name}</h1>
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-lg">
                <MapPin className="w-5 h-5 text-gray-400" />
                {location}
              </div>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                  <Leaf className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span className="text-[11px] font-bold text-[#2E7D32]">{calculateExperience(farmer.createdAt)} on CropLine</span>
                </div>
              </div>
            </div>

            {/* Verified Badge Right Aligned */}
            {farmer.isVerified && (
              <div className="absolute right-10 bottom-10">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-gray-100">
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
                  <span className="text-sm font-bold text-gray-700">Verified Farmer</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center shrink-0">
              <Leaf className="w-6 h-6 text-[#2E7D32]" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#1B5E20]">{farmer.activeCrops?.length || 0}</p>
              <p className="text-xs font-semibold text-gray-500">Crops Listed</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#1B5E20]">0</p>
              <p className="text-xs font-semibold text-gray-500">Orders Completed</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#1B5E20]">{farmer.rating?.toFixed(1) || '0.0'}</p>
              <p className="text-xs font-semibold text-gray-500">Average Rating</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-[#1B5E20]">{farmer.reviews?.totalCount || 0}</p>
              <p className="text-xs font-semibold text-gray-500">Happy Customers</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout: About & Top Crops */}
        <div className="grid grid-cols-[1fr_2fr] gap-6">
          {/* About Section */}
          <div className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm">
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
          <div className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-black text-[#1B5E20]">Top Crops</h2>
              <button className="text-sm font-bold text-[#2E7D32] hover:text-[#1B5E20] transition-colors">
                View All
              </button>
            </div>
            <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-6"></div>

            <div className="grid grid-cols-4 gap-4">
              {farmer.activeCrops?.map((crop: any) => (
                <div key={crop.id} className="group cursor-pointer">
                  <div className="relative h-32 rounded-2xl overflow-hidden mb-3 border border-gray-100 shadow-sm flex items-center justify-center bg-gray-50">
                    {crop.catalog?.image ? (
                      <img src={crop.catalog.image} alt={crop.catalog.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <Leaf className="w-8 h-8 text-green-300" />
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800">{crop.catalog?.name || crop.variety}</h3>
                  <p className="text-sm font-semibold text-[#2E7D32]">₹{crop.price} / {crop.unit}</p>
                </div>
              ))}
              {(!farmer.activeCrops || farmer.activeCrops.length === 0) && (
                <div className="col-span-4 text-center py-8 text-gray-500 font-medium">
                  No crops listed yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black text-[#1B5E20]">Customer Reviews</h2>
            <button className="text-sm font-bold text-[#2E7D32] hover:text-[#1B5E20] transition-colors">
              View All Reviews
            </button>
          </div>
          <div className="w-8 h-1 bg-[#2E7D32] rounded-full mb-8"></div>

          <div className="grid grid-cols-3 gap-8">
            {farmer.reviews?.textReviews?.map((review: any) => (
              <div key={review.id} className="flex gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 bg-green-100 text-green-700`}>
                  {review.reviewer?.name?.charAt(0) || 'U'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-gray-800">{review.reviewer?.name || 'User'}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < Math.floor(review.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{review.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-500 leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              </div>
            ))}
            {(!farmer.reviews?.textReviews || farmer.reviews.textReviews.length === 0) && (
              <div className="col-span-3 text-center py-4 text-gray-500 font-medium">
                No reviews yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Contact Bar */}
        <div className="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-12">
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
                <p className="text-sm font-semibold text-gray-700">{location}</p>
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

          <button className="flex items-center gap-2 bg-[#2E7D32] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1B5E20] transition-colors shadow-sm">
            <MessageCircle className="w-5 h-5" />
            Message Farmer
          </button>
        </div>

      </main>

      {/* Decorative leaf accents mimicking the design background */}
      <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzJFN0QzMiI+PHBhdGggZD0iTTIxLjQgMi42QzE5LjYgLjggMTYuNyAwIDEzLjUgMGMtLjggMC0xLjUuMS0yLjEuMnYtLjFjMC0uMS0uMS0uMi0uMi0uMkgxMWMtMS4xIDAtMiAuOS0yIDJ2LjJDMi4zIDQuNCAwIDcuNiAwIDExYy0uMSAyLjEgMS4yIDQuMSAzLjEgNWgtLjJjLTEuMSAwLTIgLjktMiAydjYuOGwtMS42IDIuMmMtLjQgLjUtLjMgMS4zLjIgMS43LjIuMi41LjMuNy4zLjQgMCAuOC0uMiAxLjEtLjVsMy42LTQuOWMwLS4xLjEtLjEuMi0uMmg4LjVjMi4xLjEgNC4xLTEuMiA1LTMuMXYuMmMwLS4yIDAtLjQgMC0uNi42LTIuNCA0LTV2LTEuOWMwLTMuMi0uOC02LjEtMi42LTcuOXptLTE0IDExLjdjLTEuMiAwLTIuMy0uOC0yLjYtMWwyLjEtMi4xYzEtLjkgMS42LTIuMyAxLjYtMy44di0xbC4zLS4zYy4xLS4xLjItLjEuNC0uMS40IDAgLjguMiAxLjEuNWwxLjggMS44YzIuNyAyLjcgMi43IDcuMSAwIDkuOHYtMy43em01LjQgNS40Yy0xLjUgMC0yLjktLjYtMy45LTEuNmwtMS44LTEuOGMtLjMtLjMtLjUtLjctLjUtMS4xIDAtLjItLjEtLjMtLjItLjRsLS4zLS4zYy4zIDEuNSAxLjEgMi45IDIuMiAzLjlMMTIuOCA3LjRDMTMuMSA1IDE0LjkgMy40IDE3IDMuMWMtLjMuOC0uNCAxLjctLjQgMi42IDAgMi4zIDEgNC41IDIuNiA2LjFMMTIuOCAxOS43em00LjItNC4yYy0xLjYtMS42LTEuNi00LjMgMC01LjhsMy0zaDEuNXYxLjVMMjAgMTUuNWMtLjQuNC0uOS43LTEuNS43eiIvPjwvc3ZnPg==')] bg-no-repeat bg-left-bottom" />
      <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzJFN0QzMiI+PHBhdGggZD0iTTIxLjQgMi42QzE5LjYgLjggMTYuNyAwIDEzLjUgMGMtLjggMC0xLjUuMS0yLjEuMnYtLjFjMC0uMS0uMS0uMi0uMi0uMkgxMWMtMS4xIDAtMiAuOS0yIDJ2LjJDMi4zIDQuNCAwIDcuNiAwIDExYy0uMSAyLjEgMS4yIDQuMSAzLjEgNWgtLjJjLTEuMSAwLTIgLjktMiAydjYuOGwtMS42IDIuMmMtLjQgLjUtLjMgMS4zLjIgMS43LjIuMi41LjMuNy4zLjQgMCAuOC0uMiAxLjEtLjVsMy42LTQuOWMwLS4xLjEtLjEuMi0uMmg4LjVjMi4xLjEgNC4xLTEuMiA1LTMuMXYuMmMwLS4yIDAtLjQgMC0uNi42LTIuNCA0LTV2LTEuOWMwLTMuMi0uOC02LjEtMi42LTcuOXptLTE0IDExLjdjLTEuMiAwLTIuMy0uOC0yLjYtMWwyLjEtMi4xYzEtLjkgMS42LTIuMyAxLjYtMy44di0xbC4zLS4zYy4xLS4xLjItLjEuNC0uMS40IDAgLjguMiAxLjEuNWwxLjggMS44YzIuNyAyLjcgMi43IDcuMSAwIDkuOHYtMy43em01LjQgNS40Yy0xLjUgMC0yLjktLjYtMy45LTEuNmwtMS44LTEuOGMtLjMtLjMtLjUtLjctLjUtMS4xIDAtLjItLjEtLjMtLjItLjRsLS4zLS4zYy4zIDEuNSAxLjEgMi45IDIuMiAzLjlMMTIuOCA3LjRDMTMuMSA1IDE0LjkgMy40IDE3IDMuMWMtLjMuOC0uNCAxLjctLjQgMi42IDAgMi4zIDEgNC41IDIuNiA2LjFMMTIuOCAxOS43em00LjItNC4yYy0xLjYtMS42LTEuNi00LjMgMC01LjhsMy0zaDEuNXYxLjVMMjAgMTUuNWMtLjQuNC0uOS43LTEuNS43eiIvPjwvc3ZnPg==')] bg-no-repeat bg-right-bottom transform -scale-x-100" />
    </div>
  );
}
