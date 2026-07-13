'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Camera, CheckCircle2, Shield, Calendar, User, Phone, Mail, Globe, MapPin, 
  Car, FileText, Lock, Bell, Headphones, LogOut, Verified, ShieldCheck, 
  CreditCard, ChevronRight, Edit2, CheckCircle, AlertCircle, X, Upload, Sprout, Tractor, Droplet, TreePine, Clock, Search, ChevronDown
} from 'lucide-react';
import api from '@/lib/axios';
import LocationSelector, { LocationValue } from '@/components/LocationSelector';

const FARMING_TYPES = [
  { en: "Organic", hi: "जैविक" },
  { en: "Conventional", hi: "पारंपरिक" },
  { en: "Mixed", hi: "मिश्रित" },
  { en: "Hydroponic", hi: "हाइड्रोपोनिक" },
  { en: "Greenhouse", hi: "ग्रीनहाउस" }
];

const SOIL_TYPES = [
  { en: "Loamy", hi: "दोमट" },
  { en: "Sandy", hi: "बलुई" },
  { en: "Clay", hi: "चिकनी" },
  { en: "Silt", hi: "गाद" },
  { en: "Peat", hi: "पीट" },
  { en: "Chalky", hi: "चूनेदार" }
];

const WATER_SOURCES = [
  { en: "Tube Well", hi: "ट्यूबवेल" },
  { en: "Canal", hi: "नहर" },
  { en: "River", hi: "नदी" },
  { en: "Rainfed", hi: "वर्षा आधारित" },
  { en: "Drip Irrigation", hi: "ड्रिप सिंचाई" },
  { en: "Sprinkler", hi: "स्प्रिंकलर" },
  { en: "Pond / Lake", hi: "तालाब / झील" }
];

export default function FarmerProfile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [editModal, setEditModal] = useState<'personal' | 'farm' | 'bank' | 'about' | 'document' | null>(null);
  const [docTypeToEdit, setDocTypeToEdit] = useState<'aadhaar' | 'dl' | 'rc' | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [cropSearch, setCropSearch] = useState('');
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationValue>({ state: '', district: '', village: '', pincode: '' });

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== 'FARMER')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.activeRole === 'FARMER') {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    setFetching(true);
    try {
      const [res, catRes] = await Promise.all([
        api.get('/users/profile'),
        api.get('/crops/catalog')
      ]);
      if (res.data.success) {
        setProfileData(res.data.user);
      } else {
        setError(res.data.message || 'Failed to fetch profile');
      }
      if (catRes.data.success) {
        setCatalog(catRes.data.catalog || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setFetching(false);
    }
  };

  const openModal = (type: 'personal' | 'farm' | 'bank' | 'about' | 'document', docType?: 'aadhaar' | 'dl' | 'rc') => {
    setEditModal(type);
    if (type === 'document' && docType) {
      setDocTypeToEdit(docType);
      setFormData({
        [`${docType}Url`]: profileData?.[`${docType}Url`] || ''
      });
      return;
    }
    
    if (type === 'personal') {
      setFormData({
        name: profileData?.name || '',
        dob: profileData?.dob ? new Date(profileData.dob).toISOString().split('T')[0] : '',
        gender: profileData?.gender || '',
        phone: profileData?.phone || '',
        email: profileData?.email || '',
        languagePref: profileData?.languagePref || '',
      });
      setLocationData({
        state: profileData?.state || '',
        district: profileData?.district || '',
        village: profileData?.village || '',
        pincode: profileData?.pincode || '',
      });
    } else if (type === 'farm') {
      setFormData({
        farmArea: profileData?.farmArea || '',
        primaryCrops: profileData?.primaryCrops || '',
        farmingType: profileData?.farmingType || '',
        soilType: profileData?.soilType || '',
        waterSource: profileData?.waterSource || '',
      });
    } else if (type === 'bank') {
      setFormData({
        bankAccount: profileData?.bankAccount || '',
        bankIfsc: profileData?.bankIfsc || '',
        bankName: profileData?.bankName || '',
        accountHolderName: profileData?.accountHolderName || '',
      });
    } else if (type === 'about') {
      setFormData({
        aboutMe: profileData?.aboutMe || '',
      });
    }
  };

  const closeModal = () => {
    setEditModal(null);
    setDocTypeToEdit(null);
    setFormData({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        ...(editModal === 'personal' ? {
          village: locationData.village,
          district: locationData.district,
          state: locationData.state,
          pincode: locationData.pincode,
        } : {})
      };
      if (payload.dob) {
        payload.dob = new Date(payload.dob).toISOString();
      } else {
        delete payload.dob;
      }
      if (payload.farmArea) {
        payload.farmArea = parseFloat(payload.farmArea);
      }
      
      const res = await api.patch('/users/profile', payload);
      if (res.data.success) {
        setProfileData(res.data.user);
        closeModal();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
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

  const calculateExperience = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const joined = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joined.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears < 1) {
      const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
      if (diffMonths === 0) return 'Just Joined';
      return `${diffMonths} Month${diffMonths !== 1 ? 's' : ''}`;
    }
    return `${Math.floor(diffYears)}+ Years`;
  };

  const getFullAddress = () => {
    const parts = [p.village, p.district, p.state, 'India'].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not Provided';
  };
  
  const getFarmLocation = () => {
      const parts = [p.district, p.state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Not Provided';
  }

  const getDocumentStatus = (type: 'aadhaar' | 'dl' | 'rc') => {
    const isVerified = p[`${type}Verified`];
    const url = p[`${type}Url`];
    if (isVerified) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100">
          <CheckCircle2 size={14} /> Verified
        </div>
      );
    }
    if (url) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold border border-yellow-100">
          <Clock size={14} /> Pending Approval
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold border border-gray-200 group-hover:bg-green-50 group-hover:text-green-600 group-hover:border-green-200 transition-colors">
        <Upload size={14} /> Upload required
      </div>
    );
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
          <p className="text-sm text-gray-500 font-medium mt-1">Manage your personal and farm information</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#F9FAF7] p-8">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
          
          {/* Top Identity Card */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden flex flex-col xl:flex-row gap-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 flex-1">
              
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-32 h-32 bg-[#E8F5E9] rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-sm">
                   <img src="https://images.unsplash.com/photo-1595825833444-24e7cb15944d?auto=format&fit=crop&q=80&w=200&h=200" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <button className="absolute bottom-0 right-0 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-gray-600 hover:text-green-600 transition-colors">
                  <Camera size={18} />
                </button>
              </div>

              {/* Identity Info */}
              <div className="flex-1 text-center sm:text-left mt-2">
                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                  <h2 className="text-3xl font-black text-[#212121]">{p.name || 'User'}</h2>
                  {p.isVerified && <Verified className="text-green-600" size={24} />}
                </div>
                
                {p.isVerified ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold mb-4 border border-green-100">
                    <ShieldCheck size={14} /> Verified Farmer
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs font-bold mb-4 border border-gray-200">
                    <AlertCircle size={14} /> Unverified Farmer
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm font-semibold text-gray-600">
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <MapPin size={16} className="text-gray-400" />
                    {getFarmLocation()}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <Phone size={16} className="text-gray-400" />
                    {p.phone || 'Not Provided'}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <Mail size={16} className="text-gray-400" />
                    {p.email || 'Not Provided'}
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    <Calendar size={16} className="text-gray-400" />
                    Member since {formatMonthYear(p.createdAt)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* About Me Section */}
            <div className="w-full xl:w-[400px] bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-center relative group">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-black text-[#212121]">About Me</h3>
                <button onClick={() => openModal('about')} className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-gray-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 size={14} />
                </button>
              </div>
              <p className="text-sm font-medium text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">
                {p.aboutMe || 'No description provided. Click the edit icon to add some details about yourself.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Organic Farming</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Quality Produce</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <Sprout size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-0.5">Farm Location</p>
                  <p className="text-sm font-black text-[#212121]">{getFarmLocation()}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500 transition-colors" />
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group" onClick={() => openModal('farm')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                  <Tractor size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-0.5">Farm Size</p>
                  <p className="text-sm font-black text-[#212121]">{p.farmArea ? `${p.farmArea} Acres` : 'N/A'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-yellow-500 transition-colors" />
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-0.5">Experience</p>
                  <p className="text-sm font-black text-[#212121]">{calculateExperience(p.createdAt)}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-0.5">Verification</p>
                  <p className="text-sm font-black text-[#212121] flex items-center gap-1">
                    {p.isVerified ? 'Verified' : 'Pending'} {p.isVerified && <CheckCircle2 size={16} className="text-green-600" />}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Personal Info Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <User size={20} />
                  </div>
                  <h3 className="text-lg font-black text-[#212121]">Personal Information</h3>
                </div>
                <button 
                  onClick={() => openModal('personal')}
                  className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <User size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Full Name</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.name || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Date of Birth</p>
                    <p className="text-sm font-semibold text-[#212121]">{formatDate(p.dob)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Phone Number</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.phone || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Email Address</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.email || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 sm:col-span-2 md:col-span-1">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Address</p>
                    <p className="text-sm font-semibold text-[#212121] leading-tight max-w-[200px]">{getFullAddress()}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Preferred Language</p>
                    <p className="text-sm font-semibold text-[#212121]">{p.languagePref || 'Hindi, English'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Farm Details Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <Sprout size={20} />
                  </div>
                  <h3 className="text-lg font-black text-[#212121]">Farm Details</h3>
                </div>
                <button 
                  onClick={() => openModal('farm')}
                  className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm border border-gray-100">
                        <Sprout size={18} />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-gray-500 mb-0.5">Primary Crops</p>
                       <p className="text-sm font-semibold text-[#212121]">{p.primaryCrops || 'Not Provided'}</p>
                     </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm border border-gray-100">
                        <ShieldCheck size={18} />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-gray-500 mb-0.5">Farming Type</p>
                       <p className="text-sm font-semibold text-[#212121]">{p.farmingType || 'Not Provided'}</p>
                     </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-700 shadow-sm border border-gray-100">
                        <TreePine size={18} />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-gray-500 mb-0.5">Soil Type</p>
                       <p className="text-sm font-semibold text-[#212121]">{p.soilType || 'Not Provided'}</p>
                     </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm border border-gray-100">
                        <Droplet size={18} />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-gray-500 mb-0.5">Water Source</p>
                       <p className="text-sm font-semibold text-[#212121]">{p.waterSource || 'Not Provided'}</p>
                     </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500" />
                </div>
              </div>
            </div>

            {/* Documents Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-lg font-black text-[#212121]">Documents Verification</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div onClick={() => openModal('document', 'aadhaar')} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-gray-200 group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <ShieldCheck size={16} className="text-gray-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Aadhaar Card</span>
                  </div>
                  {getDocumentStatus('aadhaar')}
                </div>
              </div>
            </div>

             {/* Bank & Payment Information */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative lg:col-span-2">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-lg font-black text-[#212121]">Bank & Payment Info</h3>
                </div>
                <button 
                  onClick={() => openModal('bank')}
                  className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Bank Name</p>
                  <p className="text-sm font-semibold text-[#212121]">{p.bankName || 'Not Provided'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Account Number</p>
                  <p className="text-sm font-semibold text-[#212121]">{maskBankAccount(p.bankAccount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">IFSC Code</p>
                  <p className="text-sm font-semibold text-[#212121]">{p.bankIfsc || 'Not Provided'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Account Holder</p>
                  <p className="text-sm font-semibold text-[#212121]">{p.accountHolderName || 'Not Provided'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-[#212121]">
                {editModal === 'personal' && 'Edit Personal Info'}
                {editModal === 'farm' && 'Edit Farm Details'}
                {editModal === 'bank' && 'Edit Bank Details'}
                {editModal === 'about' && 'Edit About Me'}
                {editModal === 'document' && 'Edit Document'}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
                  className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200 hover:bg-green-100 transition-colors"
                  title="Toggle Language"
                >
                  {lang === 'en' ? '🌐 हिन्दी' : '🌐 English'}
                </button>
                <button onClick={closeModal} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {editModal === 'personal' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Full Name</label>
                    <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">Date of Birth</label>
                      <input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">Gender</label>
                      <select value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all">
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">Phone Number</label>
                      <input type="text" value={formData.phone || ''} disabled className="w-full bg-gray-100 border border-gray-200 text-gray-400 rounded-xl p-3.5 text-sm font-semibold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">Email Address</label>
                      <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                    </div>
                  </div>
                  <LocationSelector
                    value={locationData}
                    onChange={setLocationData}
                    showVillage={true}
                    showPincode={true}
                    label="Location / Address"
                  />
                </div>
              )}

              {editModal === 'farm' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">{lang === 'en' ? 'Farm Size (Acres)' : 'खेत का आकार (एकड़)'}</label>
                    <input type="number" step="0.1" value={formData.farmArea || ''} onChange={e => setFormData({...formData, farmArea: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">{lang === 'en' ? 'Primary Crops' : 'प्राथमिक फसलें'}</label>
                    <div className="relative">
                      <div 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold flex items-center justify-between cursor-pointer"
                        onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                      >
                        <span className="text-gray-600">
                          {(formData.primaryCrops || '').split(',').filter(Boolean).length > 0
                            ? (formData.primaryCrops || '').split(',').filter(Boolean).length + (lang === 'en' ? ' selected' : ' चयनित')
                            : (lang === 'en' ? 'Select Primary Crops' : 'प्राथमिक फसलें चुनें')}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCropDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>

                      {isCropDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-lg p-2">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                              type="text" 
                              placeholder={lang === 'en' ? "Search crops..." : "फसलें खोजें..."} 
                              value={cropSearch} 
                              onChange={e => setCropSearch(e.target.value)} 
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-[#1B5E20] outline-none transition-all" 
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                            {catalog.filter(c => 
                              (c.englishName?.toLowerCase().includes(cropSearch.toLowerCase()) || 
                               c.hindiName?.toLowerCase().includes(cropSearch.toLowerCase()))
                            ).map(c => {
                              const cropsList = (formData.primaryCrops || '').split(',').map((x: string) => x.trim()).filter(Boolean);
                              const isSelected = cropsList.includes(c.englishName);
                              return (
                                <button 
                                  key={c.id} 
                                  onClick={() => {
                                    const newCrops = isSelected 
                                      ? cropsList.filter((x: string) => x !== c.englishName) 
                                      : [...cropsList, c.englishName];
                                    setFormData({...formData, primaryCrops: newCrops.join(', ')});
                                  }}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${isSelected ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300'}`}
                                >
                                  {lang === 'en' ? c.englishName : (c.hindiName || c.englishName)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">{lang === 'en' ? 'Farming Type' : 'खेती का प्रकार'}</label>
                    <select value={formData.farmingType || ''} onChange={e => setFormData({...formData, farmingType: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all cursor-pointer">
                      <option value="">{lang === 'en' ? 'Select Farming Type' : 'खेती का प्रकार चुनें'}</option>
                      {FARMING_TYPES.map(ft => (
                        <option key={ft.en} value={ft.en}>{lang === 'en' ? ft.en : ft.hi}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">{lang === 'en' ? 'Soil Type' : 'मिट्टी का प्रकार'}</label>
                      <select value={formData.soilType || ''} onChange={e => setFormData({...formData, soilType: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all cursor-pointer">
                        <option value="">{lang === 'en' ? 'Select Soil Type' : 'मिट्टी का प्रकार चुनें'}</option>
                        {SOIL_TYPES.map(st => (
                          <option key={st.en} value={st.en}>{lang === 'en' ? st.en : st.hi}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">{lang === 'en' ? 'Water Source' : 'जल स्रोत'}</label>
                      <select value={formData.waterSource || ''} onChange={e => setFormData({...formData, waterSource: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all cursor-pointer">
                        <option value="">{lang === 'en' ? 'Select Water Source' : 'जल स्रोत चुनें'}</option>
                        {WATER_SOURCES.map(ws => (
                          <option key={ws.en} value={ws.en}>{lang === 'en' ? ws.en : ws.hi}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {editModal === 'bank' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Bank Name</label>
                    <input type="text" value={formData.bankName || ''} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Account Number</label>
                    <input type="text" value={formData.bankAccount || ''} onChange={e => setFormData({...formData, bankAccount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">IFSC Code</label>
                    <input type="text" value={formData.bankIfsc || ''} onChange={e => setFormData({...formData, bankIfsc: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Account Holder Name</label>
                    <input type="text" value={formData.accountHolderName || ''} onChange={e => setFormData({...formData, accountHolderName: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                </div>
              )}

              {editModal === 'about' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">About Me</label>
                    <textarea 
                      rows={5}
                      placeholder="Tell buyers about your farming experience, practices, and goals..."
                      value={formData.aboutMe || ''} 
                      onChange={e => setFormData({...formData, aboutMe: e.target.value})} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none" 
                    />
                  </div>
                </div>
              )}

              {editModal === 'document' && docTypeToEdit && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-yellow-800 text-sm font-medium">
                    Uploading a document will mark it as "Pending Approval". An admin will review it shortly.
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">Document Image URL (Mock upload)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Upload size={16} className="text-gray-400" />
                      </div>
                      <input type="url" placeholder="https://example.com/document.jpg" value={formData[`${docTypeToEdit}Url`] || ''} onChange={e => setFormData({...formData, [`${docTypeToEdit}Url`]: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3.5 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={closeModal} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="px-8 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">
                {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
