'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Search, MapPin, List, Clock, IndianRupee, LayoutGrid, CheckCircle2, AlertCircle, Leaf } from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/axios';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet Map to avoid SSR issues
const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false });

export default function AvailableDeliveries() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  
  // Accept state
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== 'DELIVERY')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.activeRole === 'DELIVERY') {
      fetchJobs();
    }
  }, [user]);

  const fetchJobs = async () => {
    setFetching(true);
    setError('');
    
    try {
      // 1. Get GPS coordinates
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLoc({ lat: latitude, lng: longitude });

          // 2. Fetch from backend
          const res = await api.get(`/delivery/nearby?lat=${latitude}&lng=${longitude}&radius=20`);
          if (res.data.success) {
            setJobs(res.data.data.jobs);
          } else {
            setError(res.data.message || 'Failed to fetch jobs');
          }
          setFetching(false);
        },
        async (geoError) => {
          console.warn("GPS failed, trying profile coordinates fallback:", geoError);
          let lat = user?.latitude ? Number(user.latitude) : null;
          let lng = user?.longitude ? Number(user.longitude) : null;

          if (!lat || !lng) {
            console.warn("No profile coordinates found, falling back to default test coordinates (Delhi: 28.6139, 77.2090)");
            lat = 28.6139;
            lng = 77.2090;
          }

          setUserLoc({ lat, lng });
          try {
            const res = await api.get(`/delivery/nearby?lat=${lat}&lng=${lng}&radius=20`);
            if (res.data.success) {
              setJobs(res.data.data.jobs);
            } else {
              setError(res.data.message || 'Failed to fetch jobs');
            }
          } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch nearby jobs.');
          }
          setFetching(false);
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Something went wrong while fetching jobs.');
      setFetching(false);
    }
  };

  const handleAccept = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      const res = await api.post(`/delivery/jobs/${orderId}/accept`);
      if (res.data.success) {
        // Remove from list
        setJobs(jobs.filter(j => j.orderId !== orderId));
        // Push to active deliveries
        router.push('/dashboard/delivery/active');
      }
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Failed to accept job. It may have been taken by someone else.');
    } finally {
      setAcceptingId(null);
    }
  };

  // Timer Hook for expiry calculation
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getExpiryString = (expiresAtStr: string) => {
    if (!expiresAtStr) return '';
    const expiryTime = new Date(expiresAtStr).getTime();
    const diff = expiryTime - now;
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#FDFDFD]">
      {/* Header Area */}
      <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-black text-[#212121]">Available Deliveries</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Choose a delivery to start earning</p>
        </div>
        
        {/* Top actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-[#212121] shadow-sm' : 'text-gray-500'}`}
            >
              <List size={16} className="inline-block mr-2" /> List
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'map' ? 'bg-white text-[#212121] shadow-sm' : 'text-gray-500'}`}
            >
              <MapPin size={16} className="inline-block mr-2" /> Map
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-[#F9FAF7]">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {fetching ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div>
          </div>
        ) : (
          <>
            {jobs.length === 0 && !error ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">No jobs nearby right now</h3>
                <p className="text-gray-500 text-sm mt-2">Check back later or expand your search radius.</p>
              </div>
            ) : (
              <div className="h-full">
                {viewMode === 'map' && userLoc ? (
                  <div className="h-[600px] w-full">
                    <DeliveryMap userLat={userLoc.lat} userLng={userLoc.lng} jobs={jobs} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div key={job.orderId} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-green-200 transition-colors">
                        
                        {/* 1. Crop Info & Pickup */}
                        <div className="flex items-center gap-4 w-1/4">
                          <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
                            {job.cropPhoto ? (
                              <Image src={job.cropPhoto} alt={job.cropName} fill className="object-cover" />
                            ) : (
                              <Leaf className="text-green-600" size={24} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#212121]">Order #{job.orderId.substring(0,8).toUpperCase()}</p>
                            <p className="text-xs text-gray-500 font-medium mb-1">{job.cropName} ({job.weightKg} kg)</p>
                            <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                              <MapPin size={12} /> {job.pickupDistanceKm} km away
                            </p>
                          </div>
                        </div>

                        {/* 2. Earnings */}
                        <div className="text-center w-1/6">
                          <p className="text-lg font-black text-[#212121]">₹{job.estimatedFee}</p>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Earnings</p>
                        </div>

                        {/* 3. Estimated Time */}
                        <div className="text-center w-1/6">
                          <p className="text-sm font-bold text-[#212121]">{job.estimatedTimeMins} min</p>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Est. Time</p>
                        </div>

                        {/* 4. Total Distance */}
                        <div className="text-center w-1/6">
                          <p className="text-sm font-bold text-[#212121]">{job.totalDistanceKm} km</p>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Distance</p>
                        </div>

                        {/* 5. Action Button */}
                        <div className="w-1/5 flex flex-col items-end">
                          <button
                            onClick={() => handleAccept(job.orderId)}
                            disabled={acceptingId === job.orderId}
                            className="bg-[#1B5E20] hover:bg-[#144718] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed w-full max-w-[140px]"
                          >
                            {acceptingId === job.orderId ? 'Accepting...' : 'Accept'}
                          </button>
                          {job.expiresAt && (
                            <p className="text-[10px] text-[#E53935] font-bold mt-2">
                              {getExpiryString(job.expiresAt)}
                            </p>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
