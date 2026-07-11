'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Camera, CheckCircle2, Shield, Calendar, User, Phone, Mail, Globe, MapPin, 
  Car, FileText, Lock, Bell, Headphones, LogOut, Verified, ShieldCheck, 
  CreditCard, ChevronRight, Edit2, CheckCircle, AlertCircle
} from 'lucide-react';
import api from '@/lib/axios';

export default function DeliveryProfile() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [deliveryStats, setDeliveryStats] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== 'DELIVERY')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.activeRole === 'DELIVERY') {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    setFetching(true);
    try {
      const res = await api.get('/users/profile');
      if (res.data.success) {
        setProfileData(res.data.user);
        setDeliveryStats(res.data.deliveryStats || {
          totalDeliveries: 0,
          completionRate: 0,
          cancellationRate: 0,
          onTimeRate: 0
        });
      } else {
        setError(res.data.message || 'Failed to fetch profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch profile');
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

  const p = profileData || {};
  const s = deliveryStats || {};

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not Provided';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatMonthYear = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getFullAddress = () => {
    const parts = [p.village, p.district, p.state, 'India'].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not Provided';
  };

  const maskBankAccount = (account?: string) => {
    if (!account) return 'Not Provided';
    if (account.length <= 4) return account;
    return `**** **** **** ${account.slice(-4)}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFDFD]">
      
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#212121]">My Profile</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage your personal and delivery information</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border-2 border-green-600 text-green-700 font-bold rounded-xl hover:bg-green-50 transition-colors">
          <Edit2 size={16} /> Edit Profile
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#F9FAF7] p-8">
        <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row gap-8">
          
          {/* Left Column */}
          <div className="flex-1 space-y-8">
            
            {/* Top Identity Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
                
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-32 h-32 bg-[#E8F5E9] rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-sm">
                    {/* Placeholder for avatar, using a default icon if no image */}
                    <User size={60} className="text-[#1B5E20]" />
                  </div>
                  <button className="absolute bottom-0 right-0 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-gray-600 hover:text-green-600 transition-colors">
                    <Camera size={18} />
                  </button>
                </div>

                {/* Identity Info */}
                <div className="flex-1 text-center sm:text-left mt-2 sm:mt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 justify-center sm:justify-start">
                    <h2 className="text-2xl font-black text-[#212121] flex items-center justify-center sm:justify-start gap-2">
                      {p.name || 'Delivery Partner'} <CheckCircle size={22} className="text-green-500 fill-green-500 text-white" />
                    </h2>
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-6">
                    <span className="text-sm font-bold text-gray-700">Delivery Partner</span>
                    {p.isVerified && (
                      <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-black rounded-full border border-green-100">Verified</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 text-sm font-medium text-gray-600">
                    <div className="flex items-center gap-2"><Phone size={16} /> {p.phone || 'Not Provided'}</div>
                    <div className="flex items-center gap-2"><Mail size={16} /> {p.email || 'Not Provided'}</div>
                    <div className="flex items-center gap-2"><MapPin size={16} /> {p.district ? `${p.district}, ${p.state}` : 'Not Provided'}</div>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
                <div className="text-center sm:text-left pl-4 border-l-4 border-transparent">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Partner ID</p>
                  <p className="text-sm font-black text-[#212121]">CLDP{p.id?.substring(0,6).toUpperCase() || 'XXXXXX'}</p>
                </div>
                <div className="text-center sm:text-left pl-4 border-l-4 border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Member Since</p>
                  <p className="text-sm font-black text-[#212121]">{formatMonthYear(p.createdAt)}</p>
                </div>
                <div className="text-center sm:text-left pl-4 border-l-4 border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Deliveries</p>
                  <p className="text-sm font-black text-[#212121]">{s.totalDeliveries || 0}</p>
                </div>
                <div className="text-center sm:text-left pl-4 border-l-4 border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Average Rating</p>
                  <p className="text-sm font-black text-[#212121] flex items-center justify-center sm:justify-start gap-1">
                    <span className="text-[#FF8F00]">★</span> {p.rating ? Number(p.rating).toFixed(1) : '0.0'} / 5
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-black text-[#212121] mb-6">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <User size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Full Name</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.name || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Date of Birth</p>
                    <p className="text-sm font-semibold text-[#212121]">{formatDate(p.dob)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <User size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Gender</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.gender || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Phone Number</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.phone || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Email Address</p>
                    <p className="text-sm font-semibold text-[#212121] truncate max-w-[200px]">{p.email || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Language Preference</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.languagePref || 'English, Hindi'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 md:col-span-2">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">Address</p>
                    <p className="text-sm font-semibold text-[#212121]">{getFullAddress()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              {/* On-Time Rate */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <ShieldCheck size={20} className="text-green-600" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-600">On-Time Rate</h4>
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-black text-[#212121]">{s.onTimeRate || 0}%</span>
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-4">
                  {s.onTimeRate >= 95 ? 'You are excellent!' : s.onTimeRate >= 80 ? 'Doing well' : 'Needs improvement'}
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full" style={{ width: `${s.onTimeRate || 0}%` }} />
                </div>
              </div>

              {/* Completion Rate */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <div className="text-orange-500">★</div>
                  </div>
                  <h4 className="text-sm font-bold text-gray-600">Completion Rate</h4>
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-black text-[#212121]">{s.completionRate || 0}%</span>
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-4">
                  {s.completionRate >= 90 ? 'Keep it up!' : 'Can be better'}
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF8F00] rounded-full" style={{ width: `${s.completionRate || 0}%` }} />
                </div>
              </div>

              {/* Cancellation Rate */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <FileText size={20} className="text-red-600" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-600">Cancellation Rate</h4>
                </div>
                <div className="mb-2">
                  <span className="text-3xl font-black text-[#212121]">{s.cancellationRate || 0}%</span>
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-4">
                  {s.cancellationRate <= 5 ? 'Very Good!' : 'Warning level'}
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 rounded-full" style={{ width: `${s.cancellationRate || 0}%` }} />
                </div>
              </div>

            </div>
          </div>

          {/* Right Column */}
          <div className="w-full xl:w-[400px] shrink-0 space-y-6">
            
            {/* Documents Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-black text-[#212121]">Documents</h3>
                <button className="text-sm font-bold text-green-700 hover:underline flex items-center gap-1">
                  View All <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-4">
                
                {/* Aadhaar */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-700">
                      <CreditCard size={18} />
                    </div>
                    <span className="text-sm font-semibold text-[#212121]">Aadhaar Card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.aadhaarVerified ? (
                       <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Verified</span>
                    ) : (
                       <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><AlertCircle size={14}/> Pending</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Driving License */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-700">
                      <CreditCard size={18} />
                    </div>
                    <span className="text-sm font-semibold text-[#212121]">Driving License</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.dlVerified ? (
                       <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Verified</span>
                    ) : (
                       <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><AlertCircle size={14}/> Pending</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Vehicle RC */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-700">
                      <Car size={18} />
                    </div>
                    <span className="text-sm font-semibold text-[#212121]">Vehicle RC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.rcVerified ? (
                       <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Verified</span>
                    ) : (
                       <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><AlertCircle size={14}/> Pending</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Insurance */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-700">
                      <Shield size={18} />
                    </div>
                    <span className="text-sm font-semibold text-[#212121]">Insurance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.insuranceExpiry ? (
                       <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Valid till {new Date(p.insuranceExpiry).toLocaleDateString('en-GB', {month: '2-digit', year:'numeric'})}</span>
                    ) : (
                       <span className="text-xs font-bold text-gray-500 flex items-center gap-1">Not Uploaded</span>
                    )}
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-black text-[#212121]">Vehicle Information</h3>
                <button className="text-sm font-bold text-green-700 hover:underline">Edit</button>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-24 h-24 bg-[#F3F6EA] rounded-2xl flex items-center justify-center shrink-0">
                  {p.vehicleType === 'AUTO' || p.vehicleType === 'MINI_TRUCK' ? (
                     <Car size={40} className="text-[#1B5E20]" />
                  ) : (
                     // Placeholder for scooter/bike
                     <span className="text-4xl">🛵</span>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-bold text-gray-400">Vehicle Type</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.vehicleType || 'Not Set'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Vehicle Number</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.vehicleNumber || 'Not Set'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Color</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.vehicleColor || 'Not Set'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank & Payout */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-[#212121]">Bank & Payout</h3>
                <button className="text-sm font-bold text-green-700 hover:underline">Manage</button>
              </div>

              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#212121]">{p.bankName || 'Bank Account'}</p>
                    <p className="text-xs font-bold text-gray-500 my-0.5 font-mono">{maskBankAccount(p.bankAccount)}</p>
                    <p className="text-[10px] font-semibold text-gray-400">Account Holder: {p.accountHolderName || p.name || 'N/A'}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base font-black text-[#212121] mb-6">Quick Actions</h3>
              
              <div className="flex justify-between">
                
                <button className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 group-hover:bg-gray-50 group-hover:text-[#212121] transition-colors">
                    <Lock size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">Change<br/>Password</span>
                </button>

                <button className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 group-hover:bg-gray-50 group-hover:text-[#212121] transition-colors">
                    <Bell size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">Notification<br/>Settings</span>
                </button>

                <button className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 group-hover:bg-gray-50 group-hover:text-[#212121] transition-colors">
                    <Headphones size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 text-center leading-tight"><br/>Support</span>
                </button>

                <button onClick={logout} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full border border-red-100 bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-100 transition-colors">
                    <LogOut size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-red-500 text-center leading-tight"><br/>Logout</span>
                </button>

              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
