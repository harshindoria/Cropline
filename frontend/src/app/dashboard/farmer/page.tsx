"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import api from "@/lib/axios";
import {
  LayoutDashboard, Leaf, PlusCircle, IndianRupee, User as UserIcon,
  HelpCircle, Search, Bell, ChevronDown, Package, Clock, TrendingUp,
  Wallet, Pause, Play, Trash2, Upload, Check, X, Edit3, Save,
  MapPin, Phone, Mail, Shield, BarChart3, ShoppingCart, CheckCircle2,
  ChevronRight, Star
} from "lucide-react";

type TabType = "dashboard" | "mycrops" | "addcrop" | "earnings" | "profile" | "help";

const CATEGORY_EMOJI: Record<string, string> = {
  VEGETABLES: "🥬", FRUITS: "🍎", GRAINS: "🌾", HERBS: "🌿", DAIRY: "🥛", PULSES: "🫘", OILSEEDS: "🥜", OTHER: "📦"
};
const CATEGORY_COLORS: Record<string, string> = {
  VEGETABLES: "bg-green-100 text-green-700",
  FRUITS: "bg-orange-100 text-orange-700",
  GRAINS: "bg-amber-100 text-amber-700",
  HERBS: "bg-emerald-100 text-emerald-700",
  DAIRY: "bg-blue-100 text-blue-700",
  PULSES: "bg-red-100 text-red-700",
  OILSEEDS: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-700"
};

function FarmerDashboardContent() {
  const { user, loading, switchRole, logout } = useAuth();
  const router = useRouter();
  const [cropLang, setCropLang] = useState<"en" | "hi">("en");

  useEffect(() => {
    const saved = localStorage.getItem("cropline_crop_lang");
    if (saved === "en" || saved === "hi") {
      setCropLang(saved);
    }
  }, []);

  const toggleCropLang = () => {
    const next = cropLang === "en" ? "hi" : "en";
    setCropLang(next);
    localStorage.setItem("cropline_crop_lang", next);
  };
  const searchParams = useSearchParams();
  const tabQuery = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  useEffect(() => {
    if (tabQuery && ["dashboard", "mycrops", "addcrop", "earnings", "help"].includes(tabQuery)) {
      setActiveTab(tabQuery as TabType);
    } else if (!tabQuery) {
      setActiveTab("dashboard");
    }
  }, [tabQuery]);

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // ── Stats ──
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── My Crops ──
  const [crops, setCrops] = useState<any[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [cropFilter, setCropFilter] = useState("ALL");

  // ── Add Crop ──
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogGrouped, setCatalogGrouped] = useState<Record<string, any[]>>({});
  const [addStep, setAddStep] = useState(1);
  const [selectedCatalog, setSelectedCatalog] = useState<any>(null);
  const [catFilter, setCatFilter] = useState("ALL");
  const [cropForm, setCropForm] = useState({ quantityKg: "", basePricePerKg: "", minOrderKg: "1", harvestDate: "", description: "", selfPickupEnabled: false, isPreHarvest: false });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [offerForm, setOfferForm] = useState({ offerMinQuantityKg: "", offerDiscountPercentage: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Profile ──
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", village: "", district: "", state: "", pincode: "", farmArea: "", latitude: "", longitude: "" });

  // ── Help ──
  const [openFaq, setOpenFaq] = useState<number[]>([]);

  // Auth guard
  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "FARMER")) router.push("/dashboard");
  }, [user, loading, router]);

  // Fetch stats
  useEffect(() => {
    if (user?.activeRole === "FARMER" && (activeTab === "dashboard" || activeTab === "earnings")) {
      setLoadingStats(true);
      api.get("/crops/farmer/stats").then(r => setStats(r.data.stats)).catch(console.error).finally(() => setLoadingStats(false));
    }
  }, [activeTab, user]);

  // Fetch my crops
  useEffect(() => {
    if (user?.activeRole === "FARMER" && activeTab === "mycrops") {
      setLoadingCrops(true);
      api.get("/crops/farmer/mine").then(r => setCrops(r.data.crops || [])).catch(console.error).finally(() => setLoadingCrops(false));
    }
  }, [activeTab, user]);

  // Fetch catalog
  useEffect(() => {
    if (activeTab === "addcrop" && catalog.length === 0) {
      api.get("/crops/catalog").then(r => { setCatalog(r.data.catalog || []); setCatalogGrouped(r.data.grouped || {}); }).catch(console.error);
    }
  }, [activeTab]);

  // Init profile form
  useEffect(() => {
    if (user) setProfileForm({ name: user.name || "", village: user.village || "", district: user.district || "", state: user.state || "", pincode: user.pincode || "", farmArea: String(user.farmArea || ""), latitude: String(user.latitude || ""), longitude: String(user.longitude || "") });
  }, [user]);

  if (loading || !user) return <div className="h-screen flex items-center justify-center bg-[#FAFBFA]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]" /></div>;

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; };
  const handleRoleSwitch = (r: string) => { setShowRoleDropdown(false); if (user.roles.includes(r as any)) switchRole(r as any); };

  // ── Crop Actions ──
  const togglePause = async (id: string, status: string) => {
    try {
      await api.patch(`/crops/${id}/${status === "ACTIVE" ? "pause" : "resume"}`);
      setCrops(prev => prev.map(c => c.id === id ? { ...c, status: status === "ACTIVE" ? "PAUSED" : "ACTIVE" } : c));
    } catch (e) { console.error(e); alert("Action failed"); }
  };

  const deleteCrop = async (id: string) => {
    if (!confirm("Are you sure you want to close this listing?")) return;
    try { await api.delete(`/crops/${id}`); setCrops(prev => prev.filter(c => c.id !== id)); } catch (e: any) { alert(e.response?.data?.message || "Failed to delete"); }
  };

  // ── Add Crop Submit ──
  const handleAddCrop = async () => {
    if (!selectedCatalog) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("catalogId", selectedCatalog.id);
      fd.append("quantityKg", cropForm.quantityKg);
      fd.append("basePricePerKg", cropForm.basePricePerKg);
      fd.append("minOrderKg", cropForm.minOrderKg);
      fd.append("harvestDate", cropForm.harvestDate);
      if (cropForm.description) fd.append("description", cropForm.description);
      fd.append("selfPickupEnabled", String(cropForm.selfPickupEnabled));
      fd.append("isPreHarvest", String(cropForm.isPreHarvest));
      if (cropForm.isPreHarvest) {
        fd.append("preHarvestDeadline", cropForm.harvestDate);
      }
      fd.append("farmVillage", user.village || "Unknown");
      fd.append("farmDistrict", user.district || "Unknown");
      fd.append("farmState", user.state || "Unknown");
      fd.append("farmLatitude", "26.9124");
      fd.append("farmLongitude", "75.7873");
      if (offerForm.offerMinQuantityKg) fd.append("offerMinQuantityKg", offerForm.offerMinQuantityKg);
      if (offerForm.offerDiscountPercentage) fd.append("offerDiscountPercentage", offerForm.offerDiscountPercentage);
      photos.forEach(p => fd.append("photos", p));
      await api.post("/crops", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSubmitSuccess(true);
      setTimeout(() => { setSubmitSuccess(false); setAddStep(1); setSelectedCatalog(null); setCropForm({ quantityKg: "", basePricePerKg: "", minOrderKg: "1", harvestDate: "", description: "", selfPickupEnabled: false, isPreHarvest: false }); setPhotos([]); setPhotoPreviews([]); setOfferForm({ offerMinQuantityKg: "", offerDiscountPercentage: "" }); router.push("/dashboard/farmer?tab=mycrops"); }, 2000);
    } catch (e: any) { alert(e.response?.data?.message || "Failed to add crop"); }
    finally { setSubmitting(false); }
  };

  // ── Photo handler ──
  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(f => { const r = new FileReader(); r.onload = () => setPhotoPreviews(prev => [...prev, r.result as string]); r.readAsDataURL(f); });
  };

  // ── Profile save ──
  const saveProfile = async () => {
    try {
      const payload: any = { ...profileForm };
      if (payload.farmArea) payload.farmArea = parseFloat(payload.farmArea);
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      
      await api.patch("/users/profile", payload);
      setEditing(false); alert("Profile updated!");
    } catch { alert("Failed to update"); }
  };

  const filteredCrops = cropFilter === "ALL" ? crops : crops.filter(c => c.status === cropFilter);
  const filteredCatalog = catFilter === "ALL" ? catalog : catalog.filter((c: any) => c.category === catFilter);

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex font-[family-name:var(--font-poppins)] text-[#212121]">

      {/* ═══ SIDEBAR ═══ */}


      {/* ═══ MAIN ═══ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white px-8 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h1 className="text-2xl font-black capitalize text-gray-800">
            {activeTab === "mycrops" ? "My Crops" : activeTab === "addcrop" ? "Add Crop" : activeTab}
          </h1>
          <div className="flex items-center gap-5">
            {/* Language Toggle Button */}
            <button 
              onClick={toggleCropLang} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 hover:border-green-400 rounded-full text-xs font-bold text-[#1B5E20] transition-all shadow-sm cursor-pointer"
              title="Toggle Crop Language"
            >
              <span>🌐</span>
              <span>{cropLang === "en" ? "English Name" : "हिन्दी नाम"}</span>
            </button>

            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 w-56" />
            </div>
            <button className="relative p-2 bg-gray-50 rounded-full hover:bg-gray-100"><Bell className="w-5 h-5 text-gray-600" /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" /></button>
            {/* Role Switcher */}
            <div className="relative">
              <div onClick={() => setShowRoleDropdown(!showRoleDropdown)} className="flex items-center gap-2 cursor-pointer bg-gray-50 p-1.5 pr-4 rounded-full border border-gray-100 hover:bg-gray-100">
                <div className="w-8 h-8 bg-[#1B5E20] text-white rounded-full flex items-center justify-center font-bold text-xs">🌾</div>
                <div><p className="text-xs font-bold leading-none">{user.name?.split(" ")[0]}</p><p className="text-[10px] text-gray-500">Farmer</p></div>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
              </div>
              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-50 mb-1"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Switch Role</p></div>
                  <button onClick={() => handleRoleSwitch("BUYER")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">🛒 Buyer</button>
                  <button className="w-full text-left px-4 py-2 text-sm font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between">🌾 Farmer <CheckCircle2 className="w-3.5 h-3.5 text-[#1B5E20]" /></button>
                  <button onClick={() => handleRoleSwitch("DELIVERY")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">🛵 Delivery Boy</button>
                  {user.roles.includes("ADMIN") && <button onClick={() => handleRoleSwitch("ADMIN")} className="w-full text-left px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 border-t border-gray-50 mt-1 pt-2">🛡️ Admin</button>}
                  <div className="border-t border-gray-50 mt-2 pt-2"><button onClick={logout} className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50">Logout</button></div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">

          {activeTab === "dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 p-8 rounded-3xl bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="relative z-10">
                  <h2 className="text-3xl font-black">{greeting()}, {user.name?.split(" ")[0]} 👋</h2>
                  <p className="text-sm font-semibold text-green-100 mt-2 opacity-90">Manage your farm, track orders, and boost your earnings.</p>
                </div>
              </div>
              
              {loadingStats ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">{[1,2,3,4].map(i => <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm animate-pulse"><div className="h-4 bg-gray-200 rounded w-24 mb-3" /><div className="h-8 bg-gray-200 rounded w-16" /></div>)}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={80} /></div>
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-4"><Package className="w-6 h-6 text-green-600" /></div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Listings</p>
                    <p className="text-3xl font-black text-[#212121] mt-1">{stats?.activeCrops ?? 0}</p>
                  </div>
                  
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Clock size={80} /></div>
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4"><Clock className="w-6 h-6 text-amber-600" /></div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Orders</p>
                    <p className="text-3xl font-black text-[#212121] mt-1">{stats?.pendingOrders ?? 0}</p>
                  </div>
                  
                  <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={80} /></div>
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Earnings</p>
                    <p className="text-3xl font-black text-[#212121] mt-1">₹{(stats?.totalEarnings ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-6 text-white shadow-md relative overflow-hidden group">
                    <div className="absolute right-0 bottom-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={80} /></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm"><Wallet className="w-6 h-6 text-purple-200" /></div>
                    <p className="text-xs font-bold text-purple-200 uppercase tracking-wider">Wallet Balance</p>
                    <p className="text-3xl font-black mt-1">₹{Number(user.walletBalance).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="w-10 h-10 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-black text-[#212121] mb-2">Check Incoming Orders</h3>
                  <p className="text-sm text-gray-500 font-medium mb-6 max-w-xs">
                    You have 6 hours to accept incoming orders before they expire!
                  </p>
                  <button onClick={() => router.push("/dashboard/farmer/orders")} className="px-6 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-full text-sm font-bold shadow-md transition-all">
                    View Orders
                  </button>
                </div>
                
                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <PlusCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-lg font-black text-[#212121] mb-2">Grow Your Business</h3>
                  <p className="text-sm text-gray-500 font-medium mb-6 max-w-xs">
                    List more crops on the marketplace to attract more buyers.
                  </p>
                  <button onClick={() => router.push("/dashboard/farmer?tab=addcrop")} className="px-6 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-full text-sm font-bold transition-all">
                    Add New Crop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ TAB: MY CROPS ════════════ */}
          {activeTab === "mycrops" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-6">
                {["ALL", "ACTIVE", "PAUSED"].map(f => (
                  <button key={f} onClick={() => setCropFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${cropFilter === f ? "bg-[#1B5E20] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#1B5E20]"}`}>{f === "ALL" ? "All Crops" : f}</button>
                ))}
              </div>
              {loadingCrops ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse h-64" />)}</div>
              ) : filteredCrops.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <Leaf className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-800">No crops listed yet</h3>
                  <p className="text-sm text-gray-400 mb-4">Start selling by adding your first crop!</p>
                  <button onClick={() => router.push("/dashboard/farmer?tab=addcrop")} className="px-6 py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl text-sm font-bold">+ Add Your First Crop</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredCrops.map((crop: any) => {
                    const pct = crop.quantityKg > 0 ? Math.round((Number(crop.quantityRemainingKg) / Number(crop.quantityKg)) * 100) : 0;
                    const cat = crop.catalog?.category || "OTHER";
                    return (
                      <div key={crop.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        {/* Photo */}
                        <div className="h-40 bg-gray-100 flex items-center justify-center text-5xl relative">
                          {crop.photos?.[0] ? <img src={crop.photos[0]} alt="" className="w-full h-full object-cover" /> : <span>{CATEGORY_EMOJI[cat]}</span>}
                          <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-1 rounded-full ${crop.status === "ACTIVE" ? "bg-green-100 text-green-700" : crop.status === "PAUSED" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{crop.status}</span>
                        </div>
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-gray-800">
                                {cropLang === "hi" ? (crop.catalog?.hindiName || crop.catalog?.englishName || "Fasal") : (crop.catalog?.englishName || "Crop")}
                              </h4>
                              <p className="text-[11px] text-gray-400 font-semibold">
                                {cropLang === "hi" ? (crop.catalog?.englishName || "") : (crop.catalog?.hindiName || "")}
                              </p>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                          </div>
                          <p className="text-lg font-black text-[#1B5E20] mb-1">₹{Number(crop.basePricePerKg)}<span className="text-xs font-semibold text-gray-400">/kg</span></p>
                          {crop.marketPrice && (
                            <p className="text-[10px] font-bold text-green-700 mb-2">Avg Market Price: ₹{Number(crop.marketPrice)}/kg</p>
                          )}
                          {/* Quantity Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1"><span>{Number(crop.quantityRemainingKg)} kg left</span><span>{Number(crop.quantityKg)} kg total</span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#1B5E20] rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-400"><ShoppingCart className="w-3 h-3 inline mr-1" />{crop._count?.orders || 0} orders</span>
                            <div className="flex gap-2">
                              <button onClick={() => togglePause(crop.id, crop.status)} className={`p-2 rounded-lg transition-colors ${crop.status === "ACTIVE" ? "bg-amber-50 hover:bg-amber-100 text-amber-600" : "bg-green-50 hover:bg-green-100 text-green-600"}`}>
                                {crop.status === "ACTIVE" ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                              <button onClick={() => deleteCrop(crop.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ TAB: ADD CROP ════════════ */}
          {activeTab === "addcrop" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
              {submitSuccess ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>
                  <h3 className="text-xl font-black text-gray-800">Crop Listed Successfully! 🎉</h3>
                  <p className="text-sm text-gray-500 mt-2">Redirecting to My Crops...</p>
                </div>
              ) : (
                <>
                  {/* Steps indicator */}
                  <div className="flex items-center gap-3 mb-8">
                    {[1, 2, 3].map(s => (
                      <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${addStep >= s ? "bg-[#1B5E20] text-white" : "bg-gray-200 text-gray-500"}`}>{addStep > s ? <Check size={14} /> : s}</div>
                        <span className={`text-xs font-bold ${addStep >= s ? "text-[#1B5E20]" : "text-gray-400"}`}>{s === 1 ? "Select Crop" : s === 2 ? "Details" : "Photos & Submit"}</span>
                        {s < 3 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                      </div>
                    ))}
                  </div>

                  {/* Step 1: Select Catalog */}
                  {addStep === 1 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <h3 className="font-bold text-lg mb-4">What are you selling?</h3>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {[
                          ["ALL", "🏷️", "All", "Sabhi (सभी)"],
                          ["VEGETABLES", "🥬", "Vegetables", "Sabji (सब्जी)"],
                          ["FRUITS", "🍎", "Fruits", "Fal (फल)"],
                          ["GRAINS", "🌾", "Grains", "Anaaj (अनाज)"],
                          ["PULSES", "🫘", "Pulses", "Daalein (दालें)"],
                          ["OILSEEDS", "🥜", "Oilseeds", "Tilhan (तिलहन)"],
                          ["HERBS", "🌿", "Herbs", "Jadi-buti (जड़ी-बूटी)"],
                          ["DAIRY", "🥛", "Dairy", "Dairy (डेयरी)"]
                        ].map(([id, em, engName, hinName]) => (
                          <button key={id} onClick={() => setCatFilter(id)} className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${catFilter === id ? "bg-[#1B5E20] text-white" : "bg-gray-50 border border-gray-200 text-gray-600 hover:border-[#1B5E20]"}`}>{em} {cropLang === "hi" ? hinName : engName}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredCatalog.map((item: any) => (
                          <div key={item.id} onClick={() => setSelectedCatalog(item)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedCatalog?.id === item.id ? "border-[#1B5E20] bg-green-50/50" : "border-gray-100 hover:border-gray-300"}`}>
                            <div className="text-2xl mb-1">{CATEGORY_EMOJI[item.category]}</div>
                            <p className="text-sm font-bold text-gray-800">
                              {cropLang === "hi" ? (item.hindiName || item.englishName) : item.englishName}
                            </p>
                            <p className="text-[10px] font-semibold text-gray-400">
                              {cropLang === "hi" ? item.englishName : item.hindiName}
                            </p>
                            {item.marketPrice ? (
                              <p className="text-[10px] font-bold text-green-700 mt-1">Market: ₹{item.marketPrice}/kg</p>
                            ) : (
                              <p className="text-[10px] font-semibold text-gray-400 mt-1">No market price</p>
                            )}
                            {selectedCatalog?.id === item.id && <Check size={14} className="text-[#1B5E20] mt-1" />}
                          </div>
                        ))}
                      </div>
                      <button disabled={!selectedCatalog} onClick={() => setAddStep(2)} className="mt-6 w-full py-3.5 bg-[#1B5E20] hover:bg-[#2E7D32] disabled:bg-gray-300 text-white rounded-xl text-sm font-bold transition-colors">Continue → Crop Details</button>
                    </div>
                  )}

                  {/* Step 2: Details */}
                  {addStep === 2 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <span className="text-2xl">{CATEGORY_EMOJI[selectedCatalog?.category]}</span>
                        <div>
                          <h3 className="font-bold text-lg">
                            {cropLang === "hi" ? (selectedCatalog?.hindiName || selectedCatalog?.englishName) : selectedCatalog?.englishName}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {cropLang === "hi" ? selectedCatalog?.englishName : selectedCatalog?.hindiName}
                          </p>
                          {selectedCatalog?.marketPrice && (
                            <p className="text-xs font-bold text-green-700 mt-0.5">Average Market Price: ₹{selectedCatalog.marketPrice}/kg</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField label="Quantity (kg)" type="number" placeholder="e.g. 500" value={cropForm.quantityKg} onChange={v => setCropForm(p => ({ ...p, quantityKg: v }))} />
                        <InputField label="Price per kg (₹)" type="number" placeholder="e.g. 25" value={cropForm.basePricePerKg} onChange={v => setCropForm(p => ({ ...p, basePricePerKg: v }))} />
                        <InputField label="Min Order (kg)" type="number" placeholder="e.g. 1" value={cropForm.minOrderKg} onChange={v => setCropForm(p => ({ ...p, minOrderKg: v }))} />
                        <InputField 
                          label="Harvest Date" 
                          type="date" 
                          value={cropForm.harvestDate} 
                          onChange={v => setCropForm(p => ({ ...p, harvestDate: v }))}
                          min={cropForm.isPreHarvest ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : undefined}
                          max={cropForm.isPreHarvest ? undefined : new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="mt-4">
                        <label className="text-xs font-bold text-gray-600 block mb-1.5">Description (optional)</label>
                        <textarea rows={3} placeholder="Describe your crop quality, organic methods, etc..." value={cropForm.description} onChange={e => setCropForm(p => ({ ...p, description: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] resize-none" />
                      </div>
                      <div className="flex gap-6 mt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={cropForm.isPreHarvest} 
                            onChange={e => {
                              const checked = e.target.checked;
                              setCropForm(p => {
                                const today = new Date().toISOString().split('T')[0];
                                let newDate = p.harvestDate;
                                if (checked && p.harvestDate && p.harvestDate <= today) {
                                  newDate = "";
                                } else if (!checked && p.harvestDate && p.harvestDate > today) {
                                  newDate = "";
                                }
                                return { ...p, isPreHarvest: checked, harvestDate: newDate };
                              });
                            }} 
                            className="accent-[#1B5E20] w-4 h-4" 
                          />
                          <span className="text-sm font-bold text-gray-600">Pre-Harvest Listing</span>
                        </label>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={() => setAddStep(1)} className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold">← Back</button>
                        <button disabled={!cropForm.quantityKg || !cropForm.basePricePerKg || !cropForm.harvestDate} onClick={() => setAddStep(3)} className="flex-1 py-3.5 bg-[#1B5E20] hover:bg-[#2E7D32] disabled:bg-gray-300 text-white rounded-xl text-sm font-bold">Continue → Photos</button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Photos & Submit */}
                  {addStep === 3 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <h3 className="font-bold text-lg mb-4">Upload Photos & Offers</h3>
                      {/* Photo Upload */}
                      <div className="mb-6">
                        <label className="text-xs font-bold text-gray-600 block mb-2">Crop Photos (max 5)</label>
                        <div className="flex flex-wrap gap-3">
                          {photoPreviews.map((src, i) => (
                            <div key={i} className="w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 relative">
                              <img src={src} alt="" className="w-full h-full object-cover" />
                              <button onClick={() => { setPhotos(p => p.filter((_, idx) => idx !== i)); setPhotoPreviews(p => p.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                            </div>
                          ))}
                          {photos.length < 5 && (
                            <button onClick={() => fileRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#1B5E20] hover:text-[#1B5E20] transition-colors">
                              <Upload size={20} /><span className="text-[10px] font-bold mt-1">Add</span>
                            </button>
                          )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
                      </div>
                      {/* Bulk Offer */}
                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-bold text-gray-700 mb-3">Bulk Offer (optional)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <InputField label="Min Quantity for Discount (kg)" type="number" placeholder="e.g. 50" value={offerForm.offerMinQuantityKg} onChange={v => setOfferForm(p => ({ ...p, offerMinQuantityKg: v }))} />
                          <InputField label="Discount (%)" type="number" placeholder="e.g. 10" value={offerForm.offerDiscountPercentage} onChange={v => setOfferForm(p => ({ ...p, offerDiscountPercentage: v }))} />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button onClick={() => setAddStep(2)} className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold">← Back</button>
                        <button disabled={submitting} onClick={handleAddCrop} className="flex-1 py-3.5 bg-[#1B5E20] hover:bg-[#2E7D32] disabled:bg-gray-400 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                          {submitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Submitting...</> : "🌾 List My Crop"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════ TAB: EARNINGS ════════════ */}
          {activeTab === "earnings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {loadingStats ? (
                <div className="grid grid-cols-3 gap-6">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse h-28" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard icon={TrendingUp} label="Total Earnings" value={`₹${(stats?.totalEarnings ?? 0).toLocaleString("en-IN")}`} color="text-green-600" bg="bg-green-100" />
                    <StatCard icon={IndianRupee} label="This Month" value={`₹${(stats?.monthlyEarnings?.slice(-1)[0]?.earnings ?? 0).toLocaleString("en-IN")}`} color="text-blue-600" bg="bg-blue-100" />
                    <StatCard icon={Wallet} label="Wallet Balance" value={`₹${Number(user.walletBalance).toLocaleString("en-IN")}`} color="text-purple-600" bg="bg-purple-100" />
                  </div>

                  {/* Bar Chart */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                    <h3 className="font-bold text-lg mb-6">Monthly Earnings</h3>
                    <div className="flex items-end gap-4 h-52">
                      {(stats?.monthlyEarnings || []).map((m: any, i: number) => {
                        const max = Math.max(...(stats?.monthlyEarnings || []).map((e: any) => e.earnings), 1);
                        const h = max > 0 ? (m.earnings / max) * 200 : 4;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end">
                            <p className="text-[10px] font-bold text-gray-600 mb-1">₹{m.earnings.toLocaleString("en-IN")}</p>
                            <div className="w-full bg-[#1B5E20] rounded-t-lg transition-all" style={{ height: `${Math.max(h, 4)}px` }} />
                            <p className="text-[10px] font-bold text-gray-400 mt-2">{m.month}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Crop Sales */}
                  {(stats?.cropSales?.length > 0) && (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
                      <div className="px-6 py-4 border-b border-gray-100 bg-[#FAFBFA]"><h3 className="font-bold">Crop-wise Sales</h3></div>
                      <table className="w-full text-left">
                        <thead><tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-100"><th className="p-4 pl-6">Crop</th><th className="p-4">Qty Sold</th><th className="p-4 pr-6 text-right">Earned</th></tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {stats.cropSales.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50"><td className="p-4 pl-6 font-bold text-gray-800">{c.name}</td><td className="p-4 text-sm text-gray-500">{c.sold} kg</td><td className="p-4 pr-6 text-right font-bold text-[#1B5E20]">₹{c.earned.toLocaleString("en-IN")}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Recent Transactions */}
                  {(stats?.recentTransactions?.length > 0) && (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-[#FAFBFA]"><h3 className="font-bold">Recent Transactions</h3></div>
                      <div className="divide-y divide-gray-50">
                        {stats.recentTransactions.map((t: any) => (
                          <div key={t.id} className="px-6 py-4 flex items-center justify-between">
                            <div><p className="text-sm font-bold text-gray-800">{t.cropName} — {t.quantityKg} kg</p><p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString("en-IN")}</p></div>
                            <p className="font-bold text-[#1B5E20]">+₹{t.earned.toLocaleString("en-IN")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!stats?.cropSales?.length && !stats?.recentTransactions?.length) && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                      <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" /><h3 className="text-lg font-bold text-gray-400">No earnings data yet</h3><p className="text-sm text-gray-400">Start selling crops to see your earnings here!</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════ TAB: HELP ════════════ */}
          {activeTab === "help" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
              <h2 className="text-xl font-black mb-6">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {FAQ_ITEMS.map((faq, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button onClick={() => setOpenFaq(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} className="w-full px-6 py-4 flex items-center justify-between text-left">
                      <div className="flex items-center gap-3"><span className="text-xl">{faq.emoji}</span><span className="text-sm font-bold text-gray-800">{faq.q}</span></div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openFaq.includes(i) ? "rotate-180" : ""}`} />
                    </button>
                    {openFaq.includes(i) && <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">{faq.a}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function FarmerDashboard() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    }>
      <FarmerDashboardContent />
    </Suspense>
  );
}

// ═══ SUB-COMPONENTS ═══

const StatCard = ({ icon: Icon, label, value, color, bg }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} shrink-0`}><Icon className={`w-7 h-7 ${color}`} /></div>
    <div><p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">{label}</p><h3 className="text-2xl font-black text-gray-800">{value}</h3></div>
  </div>
);

const InputField = ({ label, type, placeholder, value, onChange, min, max }: { label: string; type: string; placeholder?: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1.5">{label}</label>
    <input type={type} placeholder={placeholder} value={value} min={min} max={max} onChange={e => onChange(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-semibold outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]" />
  </div>
);

const ProfileField = ({ icon: Icon, label, value, editing, onChange }: any) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
      {editing && onChange ? (
        <input value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full text-sm font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1 mt-0.5 outline-none focus:border-[#1B5E20]" />
      ) : (
        <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
      )}
    </div>
  </div>
);

const FAQ_ITEMS = [
  { emoji: "🌾", q: "How to list your first crop?", a: "Go to the \"Add Crop\" tab in your sidebar. Step 1: Select your crop from our catalog (e.g., Potato, Wheat). Step 2: Enter details like quantity, price per kg, and harvest date. Step 3: Upload photos of your crop and hit submit. Your crop will be live and visible to buyers instantly!" },
  { emoji: "💰", q: "How pricing works on CropLine?", a: "You set the base price per kg. CropLine charges a small platform fee (deducted from earnings). You can offer bulk discounts — if a buyer orders above your minimum quantity, they get the discount automatically. Your earnings per order are shown clearly in the Earnings tab." },
  { emoji: "🚚", q: "Understanding orders & delivery", a: "When a buyer places an order, you'll get a notification. You can Confirm or Reject the order. Once confirmed, prepare the crop and mark it as 'Ready for Pickup'. For delivery orders, a delivery partner will come to collect. For self-pickup, the buyer will come directly with a QR code for verification." },
  { emoji: "🏦", q: "How to get paid?", a: "All earnings are credited to your CropLine Wallet after order completion. You can request a payout to your linked bank account at any time. Payouts are processed within 24-48 hours. Make sure your bank details are updated in your Profile." },
  { emoji: "✅", q: "Account & verification", a: "Your account is verified once an admin reviews your farmer application. Verified farmers get a badge visible to buyers, which increases trust and sales. Keep your Aadhaar last 4 digits and farm area updated for faster verification." },
  { emoji: "📞", q: "Contact support", a: "For any issues, reach out to us at support@cropline.com or call our helpline at 1800-CROP-LINE (toll-free). Our support team is available Monday to Saturday, 9 AM to 6 PM IST. You can also raise a complaint through the buyer's order page if there's a dispute." },
];
