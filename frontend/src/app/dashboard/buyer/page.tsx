"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  Search, MapPin, Bell, ChevronDown, Leaf, LayoutDashboard, Store, 
  BarChart2, Package, Users, Truck, User as UserIcon, Heart, 
  ChevronRight, Gift, Headphones, ShieldCheck, Clock, ThumbsUp, Plus, Minus, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ApplicationModal from "@/components/ApplicationModal";

// Mock Categories
const categories = [
  { name: "Grains", emoji: "🌾", bg: "bg-orange-50" },
  { name: "Vegetables", emoji: "🍅", bg: "bg-red-50" },
  { name: "Fruits", emoji: "🍎", bg: "bg-red-50" },
  { name: "Pulses", emoji: "🫘", bg: "bg-green-50" },
  { name: "Oilseeds", emoji: "🥜", bg: "bg-yellow-50" },
];

export default function BuyerDashboard() {
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

  const getCropName = (crop: any) => {
    if (cropLang === "hi" && crop.catalog?.hindiName) {
      return crop.catalog.hindiName;
    }
    return crop.cropName || crop.catalog?.englishName || "Crop";
  };
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [crops, setCrops] = useState<any[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [activeSidebarTab, setActiveSidebarTab] = useState<"Dashboard" | "Marketplace">("Dashboard");
  const [maxDistance, setMaxDistance] = useState<number>(50); // 50 km default
  const [isDistanceFilterEnabled, setIsDistanceFilterEnabled] = useState<boolean>(false);
  const limit = activeSidebarTab === "Dashboard" ? 4 : 8;

  // Cart logic
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("ONLINE");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Application Modal state
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appRole, setAppRole] = useState<"FARMER" | "DELIVERY" | null>(null);

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

  const totalCartPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const crop = crops.find(c => c.id === id);
    return sum + (crop ? (crop.basePricePerKg || 0) * qty : 0);
  }, 0);

  const handleCheckout = async () => {
    if (Object.keys(cart).length === 0) return;
    
    // Add Razorpay Script dynamically if it's not present
    if (paymentMethod === "ONLINE" && !document.getElementById("razorpay-script")) {
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);
    }

    try {
      let firstOrderId: string | null = null;
      let firstOrderAmount = 0;
      let firstCropDetails = null;
      
      // We will place orders sequentially
      for (const [cropId, quantityKg] of Object.entries(cart)) {
        const crop = crops.find(c => c.id === cropId);
        if (!crop) continue;

        const orderRes = await api.post("/orders", {
          cropId: crop.id,
          quantityKg,
          deliveryType: "DELIVERY",
          paymentType: paymentMethod === "ONLINE" ? "ONLINE" : "CASH_ON_PICKUP",
          deliveryLatitude: 26.9124, 
          deliveryLongitude: 75.7873, 
          deliveryAddress: user?.district ? `${user.district}, ${user.state}` : "Jaipur, Rajasthan"
        });

        if (orderRes.data.success) {
          if (!firstOrderId) {
            firstOrderId = orderRes.data.data.id;
            firstCropDetails = crop;
          }
        }
      }

      if (!firstOrderId) {
        alert("Failed to place any orders.");
        return;
      }

      if (paymentMethod === "ONLINE") {
        // Initiate Razorpay Payment for the first order as a representative payment
        // (In a real app, backend should support bulk order payment)
        const payRes = await api.post(`/payments/order/${firstOrderId}/initiate`);
        if (payRes.data.success) {
          const { providerOrderId, amount, currency } = payRes.data.data;
          
          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: amount,
            currency: currency,
            name: "CropLine",
            description: `Payment for Order`,
            order_id: providerOrderId,
            handler: function(response: any) {
              setCart({});
              setShowCart(false);
              router.push(`/dashboard/buyer/orders`);
            },
            prefill: {
              name: user?.name,
              email: user?.email,
              contact: user?.phone
            },
            theme: { color: "#1B5E20" }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } else {
            alert("Failed to initiate payment");
        }
      } else {
        alert(`Order placed successfully using COD!`);
        setCart({});
        setShowCart(false);
        router.push(`/dashboard/buyer/orders`);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      alert(err?.response?.data?.message || err.message || "Failed to place order.");
    }
  };

  // Handle role switching
  const handleRoleSwitch = (targetRole: string) => {
    setShowRoleDropdown(false);
    
    if (!user || !user.roles.includes(targetRole as any)) {
      setAppRole(targetRole as "FARMER" | "DELIVERY");
      setAppModalOpen(true);
      return;
    }
    switchRole(targetRole as any);
  };

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setPage(1);
  }, [activeSidebarTab]);

  useEffect(() => {
    const fetchCrops = async () => {
      try {
        setLoadingCrops(true);
        let endpoint = selectedCategory === "All" 
          ? `/crops?limit=${limit}&page=${page}` 
          : `/crops?category=${selectedCategory.toUpperCase()}&limit=${limit}&page=${page}`;
        
        if (isDistanceFilterEnabled && user?.latitude && user?.longitude) {
          endpoint += `&lat=${user.latitude}&lng=${user.longitude}&radius=${maxDistance}`;
        }

        const res = await api.get(endpoint);
        if (res.data.success) {
          setCrops(res.data.data.crops || []);
          setTotalPages(res.data.data.meta?.totalPages || 1);
        }
      } catch (err) {
        console.error("Failed to fetch crops", err);
      } finally {
        setLoadingCrops(false);
      }
    };
    if (user && user.activeRole === "BUYER") {
      fetchCrops();
    }
  }, [user, selectedCategory, page, activeSidebarTab, isDistanceFilterEnabled, maxDistance]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  // Client-side search filtering
  let displayedCrops = crops.filter(c => {
    const query = searchQuery.toLowerCase();
    const name = (c.cropName || c.catalog?.englishName || "").toLowerCase();
    const hindiName = (c.catalog?.hindiName || "").toLowerCase();
    const farmerName = (c.farmer?.name || "").toLowerCase();
    return name.includes(query) || hindiName.includes(query) || farmerName.includes(query);
  });

  if (sortBy === "price_asc") {
    displayedCrops.sort((a, b) => (Number(a.basePricePerKg) || 0) - (Number(b.basePricePerKg) || 0));
  } else if (sortBy === "price_desc") {
    displayedCrops.sort((a, b) => (Number(b.basePricePerKg) || 0) - (Number(a.basePricePerKg) || 0));
  } else if (sortBy === "rating") {
    displayedCrops.sort((a, b) => (Number(b.farmer?.rating) || 0) - (Number(a.farmer?.rating) || 0));
  }

  const locationStr = user.district ? `${user.district}, ${user.state}` : "Jaipur, Rajasthan";

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex font-[family-name:var(--font-poppins)] text-[#212121]">
      
      {/* Sidebar (Based on generated image) */}
      <aside className="w-64 bg-[#F2F7F2] border-r border-green-100 flex flex-col justify-between hidden lg:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-10">
            <Leaf className="w-6 h-6 text-[#1B5E20]" />
            <span className="text-xl font-extrabold text-[#1B5E20] uppercase tracking-wide">
              Crop<span className="text-[#FFC107]">Line</span>
            </span>
          </div>

          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
              <UserIcon className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-bold">{user.name?.split(" ")[0] || "Buyer"}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.activeRole}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
          </div>

          <nav className="space-y-2">
            {[
              { name: "Dashboard", icon: LayoutDashboard },
              { name: "Marketplace", icon: Store },
              { name: "Analytics", icon: BarChart2 },
              { name: "Orders", icon: Package },
              { name: "Suppliers", icon: Users },
              { name: "Profile", icon: UserIcon },
            ].map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === "Orders") router.push("/dashboard/buyer/orders");
                  else if (item.name === "Analytics") router.push("/dashboard/buyer/analytics");
                  else if (item.name === "Suppliers") router.push("/dashboard/buyer/suppliers");
                  else if (item.name === "Profile") router.push("/dashboard/buyer/profile");
                  else if (item.name === "Dashboard" || item.name === "Marketplace") {
                    setActiveSidebarTab(item.name as any);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeSidebarTab === item.name 
                    ? "bg-white text-[#1B5E20] shadow-sm" 
                    : "text-gray-500 hover:bg-white/50 hover:text-[#1B5E20]"
                }`}
              >
                <item.icon size={18} className={activeSidebarTab === item.name ? "text-[#1B5E20]" : "text-gray-400"} />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex-1 max-w-xl">
            {/* Search bar removed from here */}
          </div>
          
          <div className="flex items-center gap-6 ml-6">
            {/* Language Toggle Button */}
            <button 
              onClick={toggleCropLang} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 hover:border-green-400 rounded-full text-xs font-bold text-[#1B5E20] transition-all shadow-sm cursor-pointer"
              title="Toggle Crop Language"
            >
              <span>🌐</span>
              <span>{cropLang === "en" ? "English Name" : "हिन्दी नाम"}</span>
            </button>

            <button 
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-[#1B5E20] hover:bg-[#2E7D32] rounded-full cursor-pointer transition-colors"
            >
              <Package className="w-5 h-5 text-white" />
              {Object.keys(cart).length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FFC107] text-[#1B5E20] text-[9px] font-black rounded-full flex items-center justify-center shadow border-2 border-white">
                  {Object.keys(cart).length}
                </span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <MapPin className="w-4 h-4 text-[#1B5E20]" />
              <span className="text-sm font-bold text-gray-700">{locationStr}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            
            <div className="relative p-2 bg-gray-50 rounded-full cursor-pointer hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </div>
            
            {/* Profile / Role Switcher */}
            <div className="relative">
              <div 
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 cursor-pointer bg-gray-50 p-1.5 pr-4 rounded-full border border-gray-100 hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-[#1B5E20] text-white rounded-full flex items-center justify-center font-bold text-xs">
                  {user.name ? user.name[0] : "B"}
                </div>
                <div>
                  <p className="text-xs font-bold leading-none">{user.name?.split(" ")[0] || "User"}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Buyer</p>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
              </div>

              {/* Dropdown Menu */}
              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-gray-50 mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Switch Role</p>
                  </div>
                  
                  <button onClick={() => handleRoleSwitch("BUYER")} className="w-full text-left px-4 py-2 text-sm font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between">
                    🛒 Buyer
                    <div className="w-3 h-3 rounded-full bg-[#1B5E20] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                  </button>
                  <button onClick={() => handleRoleSwitch("FARMER")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    🌾 Farmer
                  </button>
                  <button onClick={() => handleRoleSwitch("DELIVERY")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    🛵 Delivery Boy
                  </button>
                  
                  {user.roles.includes("ADMIN") && (
                    <button onClick={() => handleRoleSwitch("ADMIN")} className="w-full text-left px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-gray-50 mt-1 pt-2">
                      🛡️ Admin Dashboard
                    </button>
                  )}

                  <div className="border-t border-gray-50 mt-2 pt-2">
                    <button onClick={logout} className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col xl:flex-row gap-8">
          
          {/* Left Column (Main) */}
          <div className="flex-1 space-y-8">
            
            {activeSidebarTab === "Dashboard" ? (
              <>
                {/* Hero Banner */}
                <div className="relative bg-gradient-to-r from-[#eef7ef] to-[#dcf0df] rounded-[32px] p-8 md:p-12 overflow-hidden border border-green-50 shadow-sm flex items-center">
                  <div className="relative z-10 w-full max-w-lg">
                    <h1 className="text-3xl md:text-4xl font-black text-[#1B5E20] leading-tight mb-3">
                      Khet se, <br />
                      <span className="text-[#2E7D32]">Seedha Aap Tak</span>
                    </h1>
                    <p className="text-sm font-semibold text-gray-700 mb-6">
                      Fresh crops, trusted farmers, <br />direct to your home.
                    </p>

                    {/* SEARCH BAR (MOVED HERE) */}
                    <div className="relative flex items-center w-full max-w-md mb-6 shadow-sm rounded-full bg-white/95 backdrop-blur-sm border border-green-100">
                      <Leaf className="absolute left-4 w-5 h-5 text-[#2E7D32]" />
                      <input
                        type="text"
                        placeholder="Search crops, farmers..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none py-3.5 pl-12 pr-24 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-200 rounded-full text-[#212121]"
                      />
                      <div onClick={() => setActiveSidebarTab("Marketplace")} className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-5 rounded-full flex items-center justify-center text-xs font-bold shadow cursor-pointer transition-colors">
                        Search
                      </div>
                    </div>

                    <button onClick={() => setActiveSidebarTab("Marketplace")} className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-transform hover:scale-105 shadow-md w-max">
                      Shop Now <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  {/* Decorative elements simulating the farm landscape */}
                  <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-20 pointer-events-none flex justify-end items-end overflow-hidden">
                    <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-green-500 rounded-full blur-3xl"></div>
                    <div className="absolute top-10 right-20 w-32 h-32 bg-yellow-400 rounded-full blur-2xl"></div>
                  </div>
                </div>

                {/* Shop by Category */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#212121]">Shop by Category</h2>
                    <button onClick={() => setActiveSidebarTab("Marketplace")} className="text-sm font-bold text-[#1B5E20] hover:underline">View All</button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
                    <div 
                      onClick={() => { setSelectedCategory("All"); setActiveSidebarTab("Marketplace"); }}
                      className="flex flex-col items-center gap-3 cursor-pointer group shrink-0 w-24"
                    >
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform shadow-sm border ${
                        selectedCategory === "All" ? "bg-[#1B5E20] border-[#1B5E20] scale-110" : "bg-gray-50 border-gray-100 group-hover:scale-110"
                      }`}>
                        <span className={selectedCategory === "All" ? "text-white text-sm font-bold" : "text-gray-400 text-sm font-bold"}>ALL</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">All Produce</span>
                    </div>

                    {categories.map((cat) => (
                      <div 
                        key={cat.name} 
                        onClick={() => { setSelectedCategory(cat.name); setActiveSidebarTab("Marketplace"); }}
                        className="flex flex-col items-center gap-3 cursor-pointer group shrink-0 w-24"
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform shadow-sm border ${
                          selectedCategory === cat.name ? "bg-[#1B5E20] border-[#1B5E20] scale-110" : `${cat.bg} border-gray-50 group-hover:scale-110`
                        }`}>
                          {cat.emoji}
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Popular Near You */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#212121]">Popular Near You</h2>
                    <div className="flex items-center gap-2">
                      <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                      >
                        <option value="newest">Newest</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                        <option value="rating">Highest Rated</option>
                      </select>
                      <button onClick={() => setActiveSidebarTab("Marketplace")} className="text-sm font-bold text-[#1B5E20] hover:underline ml-2">View All</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loadingCrops ? (
                      // Skeleton loader
                      [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 h-64 animate-pulse overflow-hidden">
                          <div className="h-32 bg-gray-200"></div>
                          <div className="p-4 space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-6 bg-gray-200 rounded w-full mt-4"></div>
                          </div>
                        </div>
                      ))
                    ) : displayedCrops.length > 0 ? (
                      displayedCrops.map((crop) => (
                        <div key={crop.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                          <Link href={`/dashboard/buyer/crop/${crop.id}`}>
                            <div className="h-32 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center text-4xl cursor-pointer">
                              {crop.images && crop.images.length > 0 ? (
                                <img src={crop.images[0].url} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : crop.photos && crop.photos.length > 0 ? (
                                <img src={crop.photos[0]} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <span>{categories.find(c => c.name.toUpperCase() === (crop.catalog?.category || crop.category))?.emoji || "🌾"}</span>
                              )}
                            </div>
                          </Link>
                          <div className="p-4">
                            <Link href={`/dashboard/buyer/crop/${crop.id}`}>
                              <h3 className="text-sm font-bold text-[#212121] truncate cursor-pointer hover:text-[#1B5E20]">{getCropName(crop)}</h3>
                            </Link>
                            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{crop.farmer?.name}</p>
                            <div className="flex items-center gap-1 mt-1.5">
                              <span className="text-[#FFC107]">★</span>
                              <span className="text-[11px] font-bold">{crop.farmer?.rating || "4.5"}</span>
                              <span className="text-[10px] text-gray-400">({crop.farmer?.ratingCount || 0})</span>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <div>
                                <p className="text-sm font-extrabold text-[#212121]">₹{crop.basePricePerKg} <span className="text-[10px] text-gray-500 font-semibold">/ kg</span></p>
                                {crop.marketPrice && (
                                  <p className="text-[9px] font-bold text-green-700 mt-0.5">Avg Market: ₹{crop.marketPrice}/kg</p>
                                )}
                              </div>
                              {cart[crop.id] ? (
                                <div className="flex items-center gap-2 bg-green-50 rounded-lg p-1 border border-green-100">
                                  <button onClick={() => removeFromCart(crop.id)} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Minus size={14} /></button>
                                  <span className="text-xs font-bold text-[#1B5E20]">{cart[crop.id]}</span>
                                  <button onClick={() => addToCart(crop.id)} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Plus size={14} /></button>
                                </div>
                              ) : (
                                <button onClick={() => addToCart(crop.id)} className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors">
                                  <Plus size={16} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-10 text-center text-gray-400 font-semibold text-sm">
                        No crops found matching your criteria.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Marketplace Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h1 className="text-2xl font-black text-[#1B5E20] uppercase tracking-wide">Marketplace</h1>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Directly Buy Fresh Produce from Farmers Across India</p>
                  </div>
                  
                  {/* Sort Option */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-gray-400 uppercase">Sort By:</span>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                    >
                      <option value="newest">Newest</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Highest Rated</option>
                    </select>
                  </div>
                </div>

                {/* Full-width Search Bar */}
                <div className="relative flex items-center w-full shadow-sm rounded-full bg-white border border-green-100">
                  <Leaf className="absolute left-4 w-5 h-5 text-[#2E7D32]" />
                  <input
                    type="text"
                    placeholder="Search crops by name, category, or farmer name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none py-4 pl-12 pr-24 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-200 rounded-full text-[#212121]"
                  />
                  <div className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-6 rounded-full flex items-center justify-center text-xs font-bold shadow cursor-pointer transition-colors">
                    Search
                  </div>
                </div>

                {/* Category Filters */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">Filter by Category</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button 
                      onClick={() => setSelectedCategory("All")}
                      className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border ${
                        selectedCategory === "All" ? "bg-[#1B5E20] text-white border-[#1B5E20]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      All Produce
                    </button>
                    {categories.map((cat) => (
                      <button 
                        key={cat.name} 
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          selectedCategory === cat.name ? "bg-[#1B5E20] text-white border-[#1B5E20]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distance Filter */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="geo-filter-checkbox"
                      checked={isDistanceFilterEnabled}
                      onChange={(e) => setIsDistanceFilterEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#1B5E20] text-[#1B5E20] focus:ring-[#1B5E20] border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="geo-filter-checkbox" className="text-xs font-black text-gray-600 uppercase cursor-pointer">
                      📍 Filter by Distance (Nearby Farmers)
                    </label>
                  </div>
                  {isDistanceFilterEnabled && (
                    <div className="flex-1 max-w-xs flex items-center gap-3">
                      <input 
                        type="range"
                        min="5"
                        max="300"
                        step="5"
                        value={maxDistance}
                        onChange={(e) => setMaxDistance(Number(e.target.value))}
                        className="w-full accent-[#1B5E20] h-1.5 bg-green-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-black text-[#1B5E20] whitespace-nowrap min-w-[70px]">
                        {maxDistance} km
                      </span>
                    </div>
                  )}
                </div>

                {/* Crops Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {loadingCrops ? (
                    // Skeleton loader
                    [...Array(limit)].map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-gray-100 h-64 animate-pulse overflow-hidden">
                        <div className="h-32 bg-gray-200"></div>
                        <div className="p-4 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-6 bg-gray-200 rounded w-full mt-4"></div>
                        </div>
                      </div>
                    ))
                  ) : displayedCrops.length > 0 ? (
                    displayedCrops.map((crop) => (
                      <div key={crop.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                        <Link href={`/dashboard/buyer/crop/${crop.id}`}>
                          <div className="h-32 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center text-4xl cursor-pointer">
                            {crop.images && crop.images.length > 0 ? (
                              <img src={crop.images[0].url} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : crop.photos && crop.photos.length > 0 ? (
                              <img src={crop.photos[0]} alt={crop.cropName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <span>{categories.find(c => c.name.toUpperCase() === (crop.catalog?.category || crop.category))?.emoji || "🌾"}</span>
                            )}
                          </div>
                        </Link>
                        <div className="p-4">
                          <Link href={`/dashboard/buyer/crop/${crop.id}`}>
                            <h3 className="text-sm font-bold text-[#212121] truncate cursor-pointer hover:text-[#1B5E20]">{getCropName(crop)}</h3>
                          </Link>
                          <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{crop.farmer?.name}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[#FFC107]">★</span>
                            <span className="text-[11px] font-bold">{crop.farmer?.rating || "4.5"}</span>
                            <span className="text-[10px] text-gray-400">({crop.farmer?.ratingCount || 0})</span>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <div>
                              <p className="text-sm font-extrabold text-[#212121]">₹{crop.basePricePerKg} <span className="text-[10px] text-gray-500 font-semibold">/ kg</span></p>
                              {crop.marketPrice && (
                                <p className="text-[9px] font-bold text-green-700 mt-0.5">Avg Market: ₹{crop.marketPrice}/kg</p>
                              )}
                            </div>
                            {cart[crop.id] ? (
                              <div className="flex items-center gap-2 bg-green-50 rounded-lg p-1 border border-green-100">
                                <button onClick={() => removeFromCart(crop.id)} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Minus size={14} /></button>
                                <span className="text-xs font-bold text-[#1B5E20]">{cart[crop.id]}</span>
                                <button onClick={() => addToCart(crop.id)} className="w-6 h-6 rounded flex items-center justify-center text-green-700 bg-white shadow-sm font-bold"><Plus size={14} /></button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(crop.id)} className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-green-700 hover:bg-green-50 hover:border-green-200 transition-colors">
                                <Plus size={16} strokeWidth={3} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-10 text-center text-gray-400 font-semibold text-sm">
                      No crops found matching your criteria.
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-bold text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Features Footer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {[
                { icon: Leaf, title: "Farm Fresh", desc: "Direct from farmers" },
                { icon: ShieldCheck, title: "Safe Payments", desc: "100% secure" },
                { icon: Clock, title: "On-time Delivery", desc: "Quick & reliable" },
                { icon: ThumbsUp, title: "Best Prices", desc: "Fair and transparent" },
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f4fbf4] flex items-center justify-center shrink-0">
                    <feat.icon className="w-5 h-5 text-[#2E7D32]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#212121]">{feat.title}</p>
                    <p className="text-[10px] text-gray-500 font-semibold">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
          </div>

          {/* Right Column (Widgets) */}
          {activeSidebarTab === "Dashboard" && (
            <div className="w-full xl:w-80 space-y-4 shrink-0">
              
              {/* My Orders Widget */}
              <div 
                onClick={() => router.push("/dashboard/buyer/orders")}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F1F8E9] flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-[#2E7D32]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#212121]">My Orders</h3>
                    <p className="text-[11px] text-gray-500 font-semibold mt-0.5">View your orders<br/>and track delivery</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1B5E20] transition-colors" />
              </div>

              {/* Favourites Widget */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-200 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF8E1] flex items-center justify-center shrink-0">
                    <Heart className="w-6 h-6 text-[#FFB300] fill-[#FFB300]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#212121]">Favourites</h3>
                    <p className="text-[11px] text-gray-500 font-semibold mt-0.5">Your saved crops<br/>and farmers</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1B5E20] transition-colors" />
              </div>

              {/* Refer & Earn */}
              <div className="bg-gradient-to-br from-[#f2f8f2] to-[#e8f5e9] rounded-2xl p-5 border border-green-50 shadow-sm relative overflow-hidden">
                <div className="relative z-10 w-2/3">
                  <h3 className="text-sm font-bold text-[#1B5E20] mb-1">Refer & Earn</h3>
                  <p className="text-[11px] text-gray-600 font-semibold leading-relaxed mb-4">
                    Invite your friends and earn exciting rewards!
                  </p>
                  <button className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors">
                    Refer Now
                  </button>
                </div>
                <div className="absolute right-0 bottom-0 top-0 w-1/3 flex items-center justify-center pr-2">
                  <Gift className="w-16 h-16 text-[#4CAF50] opacity-80" strokeWidth={1.5} />
                </div>
              </div>

              {/* Need Help? (Replacing Free Delivery) */}
              <div className="bg-gradient-to-br from-[#fafafa] to-[#f5f5f5] rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="relative z-10 w-2/3">
                  <h3 className="text-sm font-bold text-[#212121] mb-1">Need Help?</h3>
                  <p className="text-[11px] text-gray-500 font-semibold leading-relaxed mb-4">
                    We&apos;re here to support you 24x7
                  </p>
                  <button className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors">
                    Contact Support
                  </button>
                </div>
                <div className="absolute right-2 bottom-0 top-0 w-1/3 flex items-center justify-center">
                  <Headphones className="w-16 h-16 text-[#2E7D32] opacity-80" strokeWidth={1.5} />
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Cart Modal Slideover */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-md bg-white h-full flex flex-col justify-between p-6 shadow-2xl z-10">
            <div>
              <div className="flex justify-between items-center pb-5 border-b border-gray-100">
                <h3 className="text-lg font-extrabold text-[#212121] flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                  <Package className="text-[#1B5E20]" /> My Basket
                </h3>
                <button onClick={() => setShowCart(false)} className="p-1 hover:bg-gray-50 rounded-lg">
                  <span className="text-gray-400 font-bold text-xl leading-none">&times;</span>
                </button>
              </div>

              {Object.keys(cart).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <span className="text-4xl">🧺</span>
                  <p className="text-sm font-bold text-gray-500">Your basket is currently empty.</p>
                </div>
              ) : (
                <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-1">
                  {Object.entries(cart).map(([id, qty]) => {
                    const crop = crops.find(c => c.id === id);
                    if (!crop) return null;
                    return (
                      <div key={id} className="flex justify-between items-center border-b border-gray-50 pb-3">
                        <div>
                          <p className="text-sm font-bold text-[#212121]">{getCropName(crop)}</p>
                          <p className="text-xs text-[#2E7D32] font-semibold">₹{crop.basePricePerKg}/kg × {qty}kg</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => removeFromCart(id)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><Minus size={12} /></button>
                          <span className="text-sm font-bold">{qty}</span>
                          <button onClick={() => addToCart(id)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><Plus size={12} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {Object.keys(cart).length > 0 && (
              <div className="border-t border-gray-100 pt-5 space-y-5">
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl">
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                    <span>Subtotal</span>
                    <span>₹{totalCartPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                    <span>Est. Delivery Fee</span>
                    <span>₹40</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between text-sm font-extrabold text-[#212121]">
                    <span>Total Amount</span>
                    <span>₹{totalCartPrice + 40}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setPaymentMethod("ONLINE")}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === "ONLINE" ? "border-[#1B5E20] bg-green-50/50 text-[#1B5E20]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      💳 Pay Online
                    </button>
                    <button 
                      onClick={() => setPaymentMethod("COD")}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMethod === "COD" ? "border-[#1B5E20] bg-green-50/50 text-[#1B5E20]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      💵 Cash on Delivery
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleCheckout}
                  className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md"
                >
                  Confirm Order & Checkout <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ApplicationModal 
        isOpen={appModalOpen} 
        onClose={() => setAppModalOpen(false)} 
        role={appRole} 
      />
    </div>
  );
}
