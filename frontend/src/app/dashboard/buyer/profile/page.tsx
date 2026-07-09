"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, User, MapPin, Save, Loader2, CheckCircle2, Navigation, AlertCircle, Wallet
} from "lucide-react";

export default function BuyerProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    village: "",
    district: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: ""
  });

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    } else if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        village: user.village || "",
        district: user.district || "",
        state: user.state || "",
        pincode: user.pincode || "",
        latitude: user.latitude ? String(user.latitude) : "",
        longitude: user.longitude ? String(user.longitude) : ""
      });
    }
  }, [user, loading, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      // The update profile schema accepts strings for most, numbers for lat/lng
      const payload: any = { ...formData };
      if (payload.latitude) payload.latitude = Number(payload.latitude);
      if (payload.longitude) payload.longitude = Number(payload.longitude);
      
      // Remove empty strings so Zod doesn't complain about invalid types if they are supposed to be numbers
      if (payload.latitude === "" || isNaN(payload.latitude)) delete payload.latitude;
      if (payload.longitude === "" || isNaN(payload.longitude)) delete payload.longitude;

      const res = await api.patch("/users/profile", payload);
      
      if (res.data.success) {
        setSuccessMsg("Profile updated successfully!");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: any) {
      console.error("Profile update error", err);
      setErrorMsg(err.response?.data?.message || err.response?.data?.error || "Failed to update profile.");
      setTimeout(() => setErrorMsg(""), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude)
        }));
        setLocationLoading(false);
      },
      (error) => {
        console.error("Geolocation Error Code:", error.code, "Message:", error.message);
        setLocationLoading(false);
        
        let msg = "Unable to retrieve your location.";
        if (error.code === 1) {
          msg = "Location permission denied. Please allow location access in your browser settings.";
        } else if (error.code === 2) {
          msg = "Location information is unavailable (Position Unavailable).";
        } else if (error.code === 3) {
          msg = "The request to get your location timed out.";
        } else if (error.message) {
          msg = error.message;
        }

        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(""), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex flex-col text-[#212121] font-[family-name:var(--font-poppins)]">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dashboard/buyer")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#1B5E20]">Buyer Profile</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Manage your account and addresses</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:py-8 w-full flex-1">
        
        {/* Toast Notifications */}
        {successMsg && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
        )}
        
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Avatar & Overview */}
          <div className="md:col-span-1 space-y-6">
            
            {/* Avatar Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1B5E20] to-emerald-400 flex items-center justify-center text-white font-black text-4xl shadow-inner mb-4 relative">
                {user.name ? user.name.charAt(0).toUpperCase() : "B"}
                {user.isVerified && (
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <h2 className="text-lg font-black text-[#212121]">{user.name || "Buyer"}</h2>
              <p className="text-xs font-bold text-gray-500 mt-1">{user.email}</p>
              
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-[#1B5E20] rounded-lg text-[10px] font-black uppercase tracking-wider">
                <User size={12} /> Active Buyer
              </div>
            </div>

            {/* Wallet Card */}
            <div className="bg-gradient-to-br from-[#212121] to-gray-800 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</h3>
              </div>
              <p className="text-3xl font-black">₹{Number(user.walletBalance || 0).toFixed(2)}</p>
            </div>
            
          </div>

          {/* Right Column: Edit Forms */}
          <div className="md:col-span-2">
            <form onSubmit={handleSave} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              
              {/* Personal Details Section */}
              <div className="p-6 md:p-8 border-b border-gray-100">
                <h3 className="text-sm font-black text-[#212121] mb-6 flex items-center gap-2">
                  <User className="text-[#1B5E20]" size={18} /> Personal Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Full Name</label>
                    <input 
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-200 focus:bg-white rounded-xl outline-none text-sm font-semibold transition-all"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-green-200 focus:bg-white rounded-xl outline-none text-sm font-semibold transition-all"
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address Section */}
              <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-[#212121] flex items-center gap-2">
                    <MapPin className="text-[#1B5E20]" size={18} /> Delivery Address
                  </h3>
                  
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locationLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    {locationLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                    {locationLoading ? 'Locating...' : 'Auto Detect GPS'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Village / Locality</label>
                    <input 
                      type="text"
                      name="village"
                      value={formData.village}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-400 rounded-xl outline-none text-sm font-semibold transition-all shadow-xs"
                      placeholder="Village or Street"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">District</label>
                    <input 
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-400 rounded-xl outline-none text-sm font-semibold transition-all shadow-xs"
                      placeholder="e.g., Nashik"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">State</label>
                    <input 
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-400 rounded-xl outline-none text-sm font-semibold transition-all shadow-xs"
                      placeholder="e.g., Maharashtra"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pincode</label>
                    <input 
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-400 rounded-xl outline-none text-sm font-semibold transition-all shadow-xs"
                      placeholder="6-digit PIN"
                    />
                  </div>
                </div>

                {/* Display coordinates if available */}
                {(formData.latitude || formData.longitude) && (
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">GPS Coordinates active</p>
                      <p className="text-xs text-blue-600 font-semibold font-mono mt-0.5">
                        {formData.latitude}, {formData.longitude}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                )}
                {(!formData.latitude && !formData.longitude) && (
                  <p className="text-xs text-gray-500 italic">
                    Note: Capturing GPS coordinates helps us find farmers nearest to you accurately.
                  </p>
                )}
              </div>

              {/* Form Actions */}
              <div className="p-6 bg-white flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/buyer")}
                  className="px-6 py-3 bg-gray-50 text-gray-600 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-[#1B5E20] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-green-800 transition-colors cursor-pointer shadow-md shadow-green-900/20 flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
