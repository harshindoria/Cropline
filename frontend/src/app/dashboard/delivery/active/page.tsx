'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Camera, CheckCircle2, AlertCircle, Package, Clock, Wallet, ShoppingBag, Waypoints, Calendar, TrendingUp, Headset, PhoneCall, ShieldCheck, TriangleAlert, IndianRupee } from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/axios';

function CountdownTimer({ deadline }: { deadline: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ m: number, s: number } | null>(null);
  
  useEffect(() => {
    if (!deadline) return;
    const target = new Date(deadline).getTime();
    
    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ m: 0, s: 0 });
      } else {
        const m = Math.floor(diff / (1000 * 60));
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft({ m, s });
      }
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || !timeLeft) return <span>-- min</span>;
  if (timeLeft.m === 0 && timeLeft.s === 0) return <span className="text-red-500 font-bold">Overdue</span>;
  return (
    <span className={timeLeft.m < 15 ? 'text-orange-500 font-bold' : 'text-[#212121] font-bold'}>
      {timeLeft.m} min
    </span>
  );
}

export default function ActiveDeliveries() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [inProgressJobs, setInProgressJobs] = useState<any[]>([]);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState({ todayEarnings: 0, completedJobs: 0, totalDistanceKm: 0, avgTimeMins: 0 });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'inProgress' | 'completed'>('inProgress');
  
  // Action state
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Modals state
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Form state
  const [tokenInput, setTokenInput] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== 'DELIVERY')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.activeRole === 'DELIVERY') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [jobsRes, summaryRes] = await Promise.all([
        api.get('/delivery/jobs/active'),
        api.get('/delivery/stats/summary')
      ]);

      if (jobsRes.data.success) {
        setInProgressJobs(jobsRes.data.data.inProgress);
        setCompletedJobs(jobsRes.data.data.completedToday);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch active jobs');
    } finally {
      setFetching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const closeModals = () => {
    setShowPickupModal(false);
    setShowDeliveryModal(false);
    setSelectedJob(null);
    setTokenInput('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const submitPickup = async () => {
    if (!tokenInput || !photoFile || !selectedJob) return alert('Token and photo required');
    setProcessingId(selectedJob.jobId);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const formData = new FormData();
          formData.append('token', tokenInput);
          formData.append('lat', position.coords.latitude.toString());
          formData.append('lng', position.coords.longitude.toString());
          formData.append('photo', photoFile);

          const res = await api.patch('/delivery/jobs/pickup', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          if (res.data.success) {
            closeModals();
            fetchData();
          }
        } catch (err: any) {
          alert(err.response?.data?.message || 'Pickup failed');
        } finally {
          setProcessingId(null);
        }
      },
      (geoErr) => {
        alert('GPS is required to mark pickup');
        setProcessingId(null);
      }
    );
  };

  const submitDelivery = async () => {
    if (!photoFile || !selectedJob) return alert('Photo required for delivery proof');
    setProcessingId(selectedJob.jobId);
    
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);

      const res = await api.patch(`/delivery/jobs/${selectedJob.jobId}/deliver`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        closeModals();
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delivery confirmation failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div></div>;

  const currentJobs = activeTab === 'inProgress' ? inProgressJobs : completedJobs;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFDFD]">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 bg-white shrink-0">
        <h1 className="text-2xl font-black text-[#212121]">Active Deliveries</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">Manage your ongoing deliveries</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#F9FAF7] p-8">
        
        <div className="flex flex-col xl:flex-row gap-8 max-w-[1400px] mx-auto">
          
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button 
                onClick={() => setActiveTab('inProgress')}
                className={`pb-4 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inProgress' ? 'border-[#1B5E20] text-[#1B5E20]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                In Progress ({inProgressJobs.length})
              </button>
              <button 
                onClick={() => setActiveTab('completed')}
                className={`pb-4 px-4 ml-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'completed' ? 'border-[#1B5E20] text-[#1B5E20]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Completed Today ({completedJobs.length})
              </button>
            </div>

            {/* Top Stats */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-gray-100">
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                  <ShoppingBag size={20} className="text-[#1B5E20]" />
                </div>
                <p className="text-2xl font-black text-[#212121]">{inProgressJobs.length}</p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Active Deliveries</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                  <Waypoints size={20} className="text-blue-500" />
                </div>
                <p className="text-2xl font-black text-[#212121]">{inProgressJobs.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0).toFixed(1)} <span className="text-sm">km</span></p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Total Distance</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-3">
                  <Clock size={20} className="text-orange-500" />
                </div>
                {/* For remaining time stat, we just show the tightest deadline among active jobs */}
                <p className="text-2xl font-black text-[#212121]">
                  {inProgressJobs.length > 0 ? (
                     <CountdownTimer deadline={inProgressJobs[0]?.estimatedDeliveryAt} />
                  ) : (
                     <span className="text-[#212121]">--</span>
                  )}
                </p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Remaining Time</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-3">
                  <Wallet size={20} className="text-purple-600" />
                </div>
                <p className="text-2xl font-black text-[#212121]">₹{summary.todayEarnings}</p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Earnings Today</p>
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            {/* Job Cards */}
            {fetching ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div>
              </div>
            ) : currentJobs.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800">No deliveries here</h3>
                <p className="text-gray-500 text-sm mt-2 mb-6">You're all caught up for now!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {currentJobs.map((job) => (
                  <div key={job.jobId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    {/* Top Section */}
                    <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
                      {/* Left: Info */}
                      <div className="flex items-start gap-4 flex-1 min-w-[300px]">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-50 relative shrink-0">
                          <Package className="text-[#1B5E20]" size={28} />
                          <div className="absolute -top-2 -left-2 bg-green-100 text-[#1B5E20] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            {job.status === 'DELIVERED' ? 'Completed' : 'In Progress'}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base font-black text-[#212121] mb-1">Order #{job.orderId.substring(0,8).toUpperCase()}</h3>
                          <p className="text-sm font-bold text-gray-500 mb-3">{job.cropName} <span className="font-semibold">({job.weightKg} kg)</span></p>
                          
                          <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
                            <div className="flex items-start gap-3 relative">
                              <div className="w-[16px] h-[16px] rounded-full bg-green-500 border-4 border-white shadow-sm mt-0.5 z-10" />
                              <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pickup</p>
                                <p className="text-xs font-bold text-[#212121]">{job.pickupLocation.village}, {job.pickupLocation.district}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 relative">
                              <div className="w-[16px] h-[16px] rounded-full bg-red-500 border-4 border-white shadow-sm mt-0.5 z-10" />
                              <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Drop</p>
                                <p className="text-xs font-bold text-[#212121] line-clamp-1">{job.dropLocation.address}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Stats */}
                      <div className="flex items-center gap-8 px-8 border-x border-gray-100">
                        <div className="text-center">
                          <div className="flex justify-center mb-2"><Clock size={20} className="text-green-500" /></div>
                          {job.status === 'DELIVERED' ? (
                            <p className="text-lg font-black text-[#212121]">{formatTime(job.deliveredAt)}</p>
                          ) : (
                            <p className="text-lg font-black text-[#212121]"><CountdownTimer deadline={job.estimatedDeliveryAt} /></p>
                          )}
                          <p className="text-[11px] font-bold text-gray-500 mt-1">{job.status === 'DELIVERED' ? 'Delivered At' : 'Remaining'}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex justify-center mb-2"><Waypoints size={20} className="text-blue-500" /></div>
                          <p className="text-lg font-black text-[#212121]">{job.distanceKm} <span className="text-xs">km</span></p>
                          <p className="text-[11px] font-bold text-gray-500 mt-1">Total Distance</p>
                        </div>
                        <div className="text-center">
                          <div className="flex justify-center mb-2"><IndianRupee size={20} className="text-orange-500" /></div>
                          <p className="text-lg font-black text-[#212121]">₹{job.estimatedFee}</p>
                          <p className="text-[11px] font-bold text-gray-500 mt-1">Earnings</p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col gap-3 min-w-[140px]">
                        <button className="w-full bg-green-50 hover:bg-green-100 text-[#1B5E20] py-2.5 rounded-xl font-bold text-sm transition-colors text-center border border-green-200 shadow-sm">
                          View Details
                        </button>
                        
                        {job.status === 'ASSIGNED' && (
                          <button 
                            onClick={() => { setSelectedJob(job); setShowPickupModal(true); }}
                            className="w-full bg-[#1B5E20] hover:bg-[#144718] text-white py-2.5 rounded-xl font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                          >
                            <Navigation size={16} /> Navigate
                          </button>
                        )}

                        {job.status === 'PICKED_UP' && (
                          <button 
                            onClick={() => { setSelectedJob(job); setShowDeliveryModal(true); }}
                            className="w-full bg-[#1B5E20] hover:bg-[#144718] text-white py-2.5 rounded-xl font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Mark Delivered
                          </button>
                        )}
                        
                        {job.status === 'DELIVERED' && (
                           <div className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2">
                             <CheckCircle2 size={16} /> Completed
                           </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline Progress Bar */}
                    <div className="pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-2 px-2">
                        <div className={`flex flex-col items-center ${job.pickedUpAt ? 'text-[#1B5E20]' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${job.pickedUpAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Package size={14} className={job.pickedUpAt ? 'text-[#1B5E20]' : 'text-gray-400'} />
                          </div>
                          <span>Picked Up</span>
                          {job.pickedUpAt && <span className="text-[10px] font-medium text-gray-400 mt-0.5">{formatTime(job.pickedUpAt)}</span>}
                        </div>
                        
                        <div className={`flex-1 h-[2px] mx-4 mb-5 ${job.pickedUpAt ? 'bg-green-500' : 'bg-gray-200'}`} />

                        <div className={`flex flex-col items-center ${(job.status === 'PICKED_UP' || job.status === 'IN_DELIVERY' || job.status === 'DELIVERED') ? 'text-[#1B5E20]' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${(job.status === 'PICKED_UP' || job.status === 'IN_DELIVERY' || job.status === 'DELIVERED') ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Navigation size={14} className={(job.status === 'PICKED_UP' || job.status === 'IN_DELIVERY' || job.status === 'DELIVERED') ? 'text-[#1B5E20]' : 'text-gray-400'} />
                          </div>
                          <span>On the Way</span>
                        </div>
                        
                        <div className={`flex-1 h-[2px] mx-4 mb-5 ${job.deliveredAt ? 'bg-green-500' : 'bg-gray-200'}`} />

                        <div className={`flex flex-col items-center ${job.deliveredAt ? 'text-[#1B5E20]' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${job.deliveredAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <CheckCircle2 size={14} className={job.deliveredAt ? 'text-[#1B5E20]' : 'text-gray-400'} />
                          </div>
                          <span>Delivered</span>
                          {job.deliveredAt && <span className="text-[10px] font-medium text-gray-400 mt-0.5">{formatTime(job.deliveredAt)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Bottom Banner */}
            <div className="flex justify-center mt-8">
               <div className="bg-[#F1F8E9] rounded-2xl px-6 py-3 flex items-center gap-4 border border-green-100">
                 <span className="text-sm font-bold text-gray-600">Can't complete a delivery?</span>
                 <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl text-sm font-bold text-red-600 border border-red-100 shadow-sm hover:bg-red-50 transition-colors">
                   <TriangleAlert size={16} /> Report an Issue
                 </button>
               </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full xl:w-[320px] space-y-6 shrink-0">
            
            {/* Today's Summary */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-[#212121]">Today's Summary</h3>
                <Calendar size={18} className="text-green-600" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                      <ShoppingBag size={14} className="text-[#1B5E20]" />
                    </div>
                    <span className="text-xs font-bold text-gray-600">Deliveries Completed</span>
                  </div>
                  <span className="text-sm font-black text-[#212121]">{summary.completedJobs}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                      <Wallet size={14} className="text-purple-600" />
                    </div>
                    <span className="text-xs font-bold text-gray-600">Total Earnings</span>
                  </div>
                  <span className="text-sm font-black text-[#212121]">₹{summary.todayEarnings}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                      <Waypoints size={14} className="text-blue-500" />
                    </div>
                    <span className="text-xs font-bold text-gray-600">Distance Covered</span>
                  </div>
                  <span className="text-sm font-black text-[#212121]">{summary.totalDistanceKm} km</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center">
                      <Clock size={14} className="text-orange-500" />
                    </div>
                    <span className="text-xs font-bold text-gray-600">Time Online</span>
                  </div>
                  <span className="text-sm font-black text-[#212121]">--</span> {/* Ignored for now as backend doesn't support exact time */}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-[#212121] mb-4">Quick Actions</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <Wallet size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-gray-700">View Earnings</span>
                  </div>
                  <div className="text-gray-300 group-hover:text-green-600">›</div>
                </button>
                <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} className="text-orange-500" />
                    <span className="text-xs font-bold text-gray-700">My Performance</span>
                  </div>
                  <div className="text-gray-300 group-hover:text-orange-500">›</div>
                </button>
                <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <Headset size={16} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-700">Help & Support</span>
                  </div>
                  <div className="text-gray-300 group-hover:text-blue-500">›</div>
                </button>
                <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-red-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <PhoneCall size={16} className="text-red-500" />
                    <span className="text-xs font-bold text-red-600">Emergency Contact</span>
                  </div>
                  <div className="text-gray-300 group-hover:text-red-500">›</div>
                </button>
              </div>
            </div>

            {/* Safety First */}
            <div className="bg-[#F1F8E9] rounded-3xl p-6 border border-green-100 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={20} className="text-[#1B5E20]" />
                  <h3 className="text-sm font-black text-[#1B5E20]">Safety First</h3>
                </div>
                <p className="text-xs font-semibold text-green-800 leading-relaxed">
                  Your safety is our priority.<br/>Follow traffic rules and deliver safely.
                </p>
              </div>
              <LeafIcon className="absolute -bottom-4 -right-4 text-green-200 opacity-50 w-24 h-24" />
            </div>

          </div>
        </div>

      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}
      {/* Pickup Modal */}
      {showPickupModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-[#212121] mb-2">Confirm Pickup</h3>
            <p className="text-sm text-gray-500 mb-6">Ask the farmer for the QR token code and take a photo of the produce as proof.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Farmer's Token Code</label>
                <input 
                  type="text" 
                  value={tokenInput} 
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter token from farmer"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Produce Photo</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative bg-gray-50">
                  {photoPreview ? (
                    <div className="relative h-48 w-full">
                      <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                      <button onClick={() => {setPhotoPreview(null); setPhotoFile(null);}} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><CheckCircle2 size={20}/></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                      <Camera className="text-gray-400 mb-2" size={32} />
                      <span className="text-sm font-semibold text-[#1B5E20]">Tap to open camera</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={closeModals}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitPickup}
                disabled={processingId !== null || !tokenInput || !photoFile}
                className="flex-1 py-3 text-sm font-bold text-white bg-[#1B5E20] rounded-xl hover:bg-[#144718] transition-colors disabled:opacity-50"
              >
                {processingId ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-[#212121] mb-2">Confirm Delivery</h3>
            <p className="text-sm text-gray-500 mb-6">Take a photo of the delivered produce at the buyer's location as proof of delivery.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Delivery Proof Photo</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative bg-gray-50">
                  {photoPreview ? (
                    <div className="relative h-48 w-full">
                      <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                      <button onClick={() => {setPhotoPreview(null); setPhotoFile(null);}} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><CheckCircle2 size={20}/></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                      <Camera className="text-gray-400 mb-2" size={32} />
                      <span className="text-sm font-semibold text-[#1B5E20]">Tap to open camera</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={closeModals}
                className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitDelivery}
                disabled={processingId !== null || !photoFile}
                className="flex-1 py-3 text-sm font-bold text-black bg-[#FFC107] rounded-xl hover:bg-[#ffb300] transition-colors disabled:opacity-50"
              >
                {processingId ? 'Confirming...' : 'Mark Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.5 2c-3.1 0-6.1 1.6-7.8 4.3C8.1 4.2 5.6 3 2.5 3c0 0-1 4.5 1.5 8 1.9 2.7 5.1 4.4 8.5 4.9L11 22h2l1.2-5.5c3.5-.1 6.8-2 8.7-4.9 2.5-3.8 2.1-9.6 2.1-9.6s-3.7 0-7.5 0zM12 12c-2.3 0-4.3-1.1-5.6-2.9-1.2-1.7-1.1-4-.1-6.1 2.2.4 4 2.1 4.9 4.2 0 1.2-1.1 2.6-1.1 2.6L12 12zm8.5-1.9c-1.3 1.9-3.5 3.1-5.9 3.1v-2c1.2-1.3 2.7-3.1 3-5.2 2 .5 3.5 2.5 2.9 4.1z" />
    </svg>
  );
}
