"use client";

import { useAuth, Role } from "@/context/AuthContext";
import { apiErrorBody, apiErrorMessage } from "@/lib/apiError";
import type { CropListing, CropNameSource, Order, OrderSocketEvent } from "@/types/api";
import { statusStyle } from "@/lib/orderStatus";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import api from "@/lib/axios";
import {
  Search, MapPin, Bell, ChevronDown, Leaf, LayoutDashboard, Store,
  BarChart2, Package, Users, Truck, User as UserIcon,
  ChevronRight, ShieldCheck, Clock, ThumbsUp, Plus, Minus, CheckCircle2, Loader2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ApplicationModal from "@/components/ApplicationModal";
import RoleSwitcher from "@/components/RoleSwitcher";
import NotificationDropdown from "@/components/NotificationDropdown";
import { useSocket } from "@/context/SocketContext";
import { toast } from "sonner";
import CropCard from "./components/CropCard";
import LocationSelector, { LocationValue } from "@/components/LocationSelector";
import { getGpsOrSavedLocation, reverseGeocode, haversineDistance, calculateDeliveryFee, Coordinates } from "@/lib/location";
import { payForOrder } from "@/lib/razorpayCheckout";

// Mock Categories
const categories = [
  { name: "Grains", emoji: "🌾", bg: "bg-orange-50" },
  { name: "Vegetables", emoji: "🥬", bg: "bg-red-50" },
  { name: "Fruits", emoji: "🍎", bg: "bg-red-50" },
  { name: "Pulses", emoji: "🫘", bg: "bg-green-50" },
  { name: "Oilseeds", emoji: "🥜", bg: "bg-yellow-50" },
];

function BuyerDashboardContent() {
  const { user, loading, switchRole, logout } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

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

  const getCropName = (crop: CropNameSource) => {
    if (cropLang === "hi" && crop.catalog?.hindiName) {
      return crop.catalog.hindiName;
    }
    return crop.cropName || crop.catalog?.englishName || "Crop";
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [crops, setCrops] = useState<CropListing[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [activeSidebarTab, setActiveSidebarTab] = useState<"Dashboard" | "Marketplace">("Dashboard");

  useEffect(() => {
    if (tabParam === "Marketplace") {
      setActiveSidebarTab("Marketplace");
    } else {
      setActiveSidebarTab("Dashboard");
    }
  }, [tabParam]);

  const [maxDistance, setMaxDistance] = useState<number>(50); // 50 km default
  const [isDistanceFilterEnabled, setIsDistanceFilterEnabled] = useState<boolean>(false);
  const limit = activeSidebarTab === "Dashboard" ? 4 : 8;

  // Cart logic
  const [cart, setCart] = useState<Record<string, number>>({});
  // The basket keeps its own copy of each crop, so changing page or category does not drop it.
  const [cartCrops, setCartCrops] = useState<Record<string, CropListing>>({});
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("ONLINE");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // Application Modal state
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appRole, setAppRole] = useState<"FARMER" | "DELIVERY" | null>(null);

  // Location Modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationValue>({
    village: "",
    district: "",
    state: "",
    pincode: ""
  });
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [coords, setCoords] = useState({ lat: "", lng: "" });

  const handleOpenLocationModal = () => {
    setLocationData({
      village: user?.village || "",
      district: user?.district || "",
      state: user?.state || "",
      pincode: user?.pincode || ""
    });
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = async () => {
    setIsUpdatingLocation(true);
    try {
      const payload: LocationValue & { latitude?: string; longitude?: string } = {
        village: locationData.village,
        district: locationData.district,
        state: locationData.state,
        pincode: locationData.pincode,
      };
      
      if (coords.lat && coords.lng) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }
      
      const res = await api.patch('/users/profile', payload);
      if (res.data.success) {
        setIsLocationModalOpen(false);
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert(apiErrorBody(err).error || 'Failed to update location');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleGetLocation = () => {
    setErrorMsg("");
    
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setCoords({ lat: String(lat), lng: String(lng) });

        const geoData = await reverseGeocode(lat, lng);
        if (geoData) {
          setLocationData({
            state: geoData.state || '',
            district: geoData.district || '',
            village: geoData.village || '',
            pincode: geoData.pincode || '',
          });
        }
        
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        let msg = "Unable to retrieve your location.";
        if (error.code === 1) {
          msg = "Location permission denied. Please allow location access in your browser settings.";
        } else if (error.code === 2) {
          msg = "Location information is unavailable (Position Unavailable).";
        } else if (error.code === 3) {
          msg = "The request to get your location timed out.";
        } else if (error.message && !error.message.toLowerCase().includes("denied")) {
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

  // Same rules as the crop page: start at the farmer's minimum order, then 1 kg at a time,
  // never more than the farmer has left.
  const addToCart = (cropId: string) => {
    const crop = crops.find(c => c.id === cropId) ?? cartCrops[cropId];
    if (!crop) return;
    if (crop.farmerId === user?.id) {
      alert("You cannot buy your own crop!");
      return;
    }
    const minOrder = Number(crop.minOrderKg) || 1;
    const stock = Number(crop.quantityRemainingKg);
    const next = cart[cropId] ? cart[cropId] + 1 : minOrder;
    if (next > stock) {
      alert(`Only ${stock} kg of this crop is left.`);
      return;
    }
    setCartCrops(prev => ({ ...prev, [cropId]: crop }));
    setCart(prev => ({ ...prev, [cropId]: next }));
  };

  // Going below the minimum order takes the crop out of the basket.
  const removeFromCart = (cropId: string) => {
    const minOrder = Number(cartCrops[cropId]?.minOrderKg) || 1;
    setCart(prev => {
      const copy = { ...prev };
      if (copy[cropId] - 1 < minOrder) {
        delete copy[cropId];
      } else {
        copy[cropId] -= 1;
      }
      return copy;
    });
  };

  // The delivery location is found once when the basket opens. The fee shown and the
  // orders placed both use it, so the buyer pays the fee they saw.
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);
  useEffect(() => {
    if (!showCart) return;
    getGpsOrSavedLocation(user).then(setDeliveryCoords).catch(() => setDeliveryCoords(null));
  }, [showCart, user]);

  // Same sums the server charges: crop price minus the farmer's bulk discount,
  // plus a delivery fee per crop.
  let totalCartPrice = 0;
  let totalDeliveryFee = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const crop = cartCrops[id];
    if (!crop) continue;
    const cost = Number(crop.basePricePerKg) * 1.20 * qty;
    const discount = crop.offer && qty >= Number(crop.offer.minQuantityKg)
      ? (cost * Number(crop.offer.discountPercentage)) / 100
      : 0;
    totalCartPrice += cost - discount;
    if (deliveryCoords) {
      totalDeliveryFee += calculateDeliveryFee(
        haversineDistance(deliveryCoords.lat, deliveryCoords.lng, Number(crop.farmLatitude), Number(crop.farmLongitude)),
        qty
      );
    }
  }

  // Each crop becomes its own order, and one Razorpay payment can only pay for one order.
  // Until the backend can charge several orders together, online checkout takes one crop at a time.
  const onlineNeedsOneCrop = paymentMethod === "ONLINE" && Object.keys(cart).length > 1;

  // A ref, not only state, so a fast double click can't start a second checkout
  // before the button re-renders as disabled.
  const placingOrderRef = useRef(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const handleCheckout = async () => {
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;
    setPlacingOrder(true);
    try {
      await placeOrders();
    } finally {
      placingOrderRef.current = false;
      setPlacingOrder(false);
    }
  };

  const placeOrders = async () => {
    if (Object.keys(cart).length === 0) return;
    if (!deliveryCoords) {
      alert("We need your location to deliver. Allow location access, or save your location on your profile.");
      return;
    }
    const coords = deliveryCoords;

    // Checked before any order is created, so nothing is left behind unpaid.
    if (onlineNeedsOneCrop) {
      alert("Online payment works for one crop at a time. Remove the other crops from your basket, or choose Cash on Delivery.");
      return;
    }

    try {
      let firstOrderId: string | null = null;
      let firstOrderAmount = 0;
      let firstCropDetails = null;

      // We will place orders sequentially
      for (const [cropId, quantityKg] of Object.entries(cart)) {
        const crop = cartCrops[cropId];
        if (!crop) continue;

        const orderRes = await api.post("/orders", {
          cropId: crop.id,
          quantityKg,
          deliveryType: "DELIVERY",
          paymentType: paymentMethod === "ONLINE" ? "ONLINE" : "CASH",
          deliveryLatitude: coords.lat,
          deliveryLongitude: coords.lng,
          deliveryAddress: user?.district ? `${user.district}, ${user.state}` : "Unknown Address"
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
        // Online checkout only ever has one crop (see onlineNeedsOneCrop), so this is the only order.
        // The order exists now, so whatever happens with the payment the buyer lands on its page,
        // where they can pay again or cancel it.
        const paidOrderId = firstOrderId;
        setCart({});
        setShowCart(false);
        try {
          const result = await payForOrder(paidOrderId, "Payment for Order", {
            name: user?.name,
            email: user?.email,
            contact: user?.phone,
          });
          if (result === "DISMISSED") {
            alert("Payment not completed. Your order is saved, and you can pay for it from the order page.");
          }
        } catch (payErr) {
          console.error("Payment error:", payErr);
          // The server explains cases like a cancelled order whose payment was refunded.
          alert(apiErrorMessage(payErr, payErr instanceof Error ? payErr.message : "Payment could not be completed."));
        }
        router.push(`/dashboard/buyer/orders/${paidOrderId}`);
      } else {
        alert(`Order placed successfully using COD!`);
        setCart({});
        setShowCart(false);
        router.push(`/dashboard/buyer/orders`);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert(apiErrorMessage(err, err instanceof Error ? err.message : "Failed to place order."));
    }
  };

  // Handle role switching
  const handleRoleSwitch = (targetRole: string) => {
    setShowRoleDropdown(false);

    if (!user || !user.roles.includes(targetRole as Role)) {
      setAppRole(targetRole as "FARMER" | "DELIVERY");
      setAppModalOpen(true);
      return;
    }
    switchRole(targetRole as Role);
  };

  useEffect(() => {
    if (!loading) {
      if (!user || user.activeRole !== "BUYER") {
        router.push("/dashboard");
      } else if (!user.name) {
        router.push("/?completeProfile=true");
      }
    }
  }, [user, loading, router]);

  // The buyer's latest orders, shown in the right-hand column.
  const [recentOrders, setRecentOrders] = useState<Order[] | null>(null);
  const loadRecentOrders = useCallback(async () => {
    try {
      const res = await api.get("/orders");
      if (res.data.success) {
        const mine: Order[] = (res.data.orders || []).filter((o: Order) => o.buyerId === user?.id);
        setRecentOrders(mine.slice(0, 3));
      }
    } catch (err) {
      console.error("Failed to fetch orders", err);
      setRecentOrders([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.activeRole !== "BUYER") return;
    const load = async () => { await loadRecentOrders(); };
    load();
  }, [user?.activeRole, loadRecentOrders]);

  // Socket Event Listeners for Buyer
  useEffect(() => {
    if (!socket) return;

    const handleOrderAssigned = (data: OrderSocketEvent) => {
      loadRecentOrders();
      toast.success("Order Update", {
        description: data.message || "Your order status has been updated.",
        duration: 5000,
        action: {
          label: "View Orders",
          onClick: () => router.push("/dashboard/buyer/orders")
        }
      });
    };

    socket.on("order:assigned", handleOrderAssigned);
    socket.on("order:picked_up", handleOrderAssigned);

    return () => {
      socket.off("order:assigned", handleOrderAssigned);
      socket.off("order:picked_up", handleOrderAssigned);
    };
  }, [socket, router, loadRecentOrders]);

  // Wait until the buyer stops typing before asking the server.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [activeSidebarTab, selectedCategory, debouncedSearch, sortBy]);

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

        if (debouncedSearch.trim()) endpoint += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
        endpoint += `&sort=${sortBy}`;

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
  }, [user, selectedCategory, page, activeSidebarTab, isDistanceFilterEnabled, maxDistance, debouncedSearch, sortBy]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  const displayedCrops = crops.filter(c => c.farmerId !== user?.id);

  const locationStr = user.district ? `${user.district}, ${user.state}` : "Set your location";

  return (
    <>

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
          <div
            onClick={handleOpenLocationModal}
            className="hidden md:flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
          >
            <MapPin className="w-4 h-4 text-[#1B5E20]" />
            <span className="text-sm font-bold text-gray-700">{locationStr}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>

          <NotificationDropdown />

          <RoleSwitcher
            currentRole="BUYER"
            onApplyRole={(role) => {
              setAppRole(role);
              setAppModalOpen(true);
            }}
          />
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
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform shadow-sm border ${selectedCategory === "All" ? "bg-[#1B5E20] border-[#1B5E20] scale-110" : "bg-gray-50 border-gray-100 group-hover:scale-110"
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
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform shadow-sm border ${selectedCategory === cat.name ? "bg-[#1B5E20] border-[#1B5E20] scale-110" : `${cat.bg} border-gray-50 group-hover:scale-110`
                        }`}>
                        {cat.emoji}
                      </div>
                      <span className="text-xs font-semibold text-gray-600">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest crops */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#212121]">Fresh Crops</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                    >
                      <option value="newest">Newest</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
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
                      <CropCard
                        key={crop.id}
                        crop={crop}
                        categories={categories}
                        getCropName={getCropName}
                        cart={cart}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                      />
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
              {/* Marketplace Header & Banner */}
              <div className="flex flex-col lg:flex-row gap-6 mb-8">
                <div className="lg:w-1/3 flex flex-col justify-center">
                  <h1 className="text-3xl font-black text-[#0B3B24]">Marketplace</h1>
                  <p className="text-sm text-gray-600 font-medium mt-2 leading-relaxed">
                    Buy fresh produce directly from verified farmers across India.
                  </p>
                </div>
                <div className="lg:w-2/3 relative rounded-2xl overflow-hidden h-32 md:h-40 bg-gradient-to-r from-[#98d28c] to-[#cbe5ad] flex items-center shadow-sm">
                  {/* Placeholder for Banner Image / SVG */}
                  <div className="absolute inset-0 opacity-40">
                    <div className="absolute bottom-0 w-full h-1/2 bg-[#5d9c53] rounded-t-[100%]"></div>
                    <div className="absolute bottom-0 left-10 w-20 h-20 bg-[#3a7531] rounded-t-full"></div>
                    <div className="absolute bottom-0 right-32 w-32 h-32 bg-[#4b8a40] rounded-t-full"></div>
                  </div>
                  <div className="relative z-10 p-6 md:p-8 flex items-center justify-end w-full">
                    <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        <Leaf className="w-5 h-5 text-[#2E7D32]" />
                        <span className="text-sm font-black text-[#0B3B24]">100% Fresh</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">Sourced directly from farmers</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-width Search Bar & Sort */}
              <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                <div className="relative flex items-center flex-1 shadow-sm rounded-xl bg-white border border-gray-200 overflow-hidden">
                  <Leaf className="absolute left-4 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search crops by name, category, or farmer name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none py-3 pl-12 pr-4 text-sm font-medium outline-none focus:ring-0 text-[#212121]"
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-gray-500">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm font-bold text-[#212121] bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 appearance-none pr-10 relative"
                  >
                    <option value="newest">Newest</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Category Filters */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-[#212121] mb-3">Browse by Category</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    onClick={() => setSelectedCategory("All")}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 shrink-0 ${selectedCategory === "All" ? "bg-[#1B5E20] text-white border-[#1B5E20]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    <LayoutDashboard className="w-4 h-4" /> All Produce
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 shrink-0 ${selectedCategory === cat.name ? "bg-[#1B5E20] text-white border-[#1B5E20]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                      <span className="text-base">{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nearby filter */}
              <div className="flex justify-end mb-8">
                <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-2.5 shrink-0 shadow-sm">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDistanceFilterEnabled}
                      onChange={(e) => {
                        if (e.target.checked && !(user?.latitude && user?.longitude)) {
                          alert("Save your location first to see farmers near you.");
                          handleOpenLocationModal();
                          return;
                        }
                        setIsDistanceFilterEnabled(e.target.checked);
                      }}
                      className="w-5 h-5 accent-[#1B5E20] border-gray-300 rounded cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-bold text-[#212121] leading-none">Nearby Farmers</p>
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Show results near you</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Crops Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingCrops ? (
                  // Skeleton loader
                  [...Array(limit)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 h-72 animate-pulse overflow-hidden">
                      <div className="h-40 bg-gray-200"></div>
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-6 bg-gray-200 rounded w-full mt-4"></div>
                      </div>
                    </div>
                  ))
                ) : displayedCrops.length > 0 ? (
                  displayedCrops.map((crop) => (
                    <CropCard
                      key={crop.id}
                      crop={crop}
                      categories={categories}
                      getCropName={getCropName}
                      cart={cart}
                      addToCart={addToCart}
                      removeFromCart={removeFromCart}
                    />
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

            {/* Recent Orders */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-sm font-bold text-[#212121] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#2E7D32]" /> Recent Orders
                </h3>
                <Link href="/dashboard/buyer/orders" className="text-xs font-bold text-[#1B5E20] hover:underline">
                  View all
                </Link>
              </div>

              {recentOrders === null ? (
                <div className="px-5 pb-5 space-y-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="px-5 pb-6 pt-2 text-center">
                  <div className="text-3xl mb-2">🧺</div>
                  <p className="text-sm font-bold text-[#212121]">No orders yet</p>
                  <p className="text-xs text-gray-500 font-medium mt-1 mb-4">Fresh crops straight from farmers are waiting for you.</p>
                  <button
                    onClick={() => setActiveSidebarTab("Marketplace")}
                    className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    Start shopping
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {recentOrders.map(order => {
                    const status = statusStyle(order.status);
                    return (
                      <li key={order.id}>
                        <Link
                          href={`/dashboard/buyer/orders/${order.id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-[#F1F8E9] flex items-center justify-center shrink-0 text-lg">🌾</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#212121] truncate">
                              {order.crop ? getCropName(order.crop) : "Crop"}
                            </p>
                            <p className="text-[11px] text-gray-400 font-semibold">
                              {Number(order.quantityKg)} kg · {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-[#1B5E20]">₹{Number(order.totalBuyerPrice).toFixed(0)}</p>
                            <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Delivery location */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-[#212121] flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#2E7D32]" /> Delivering to
              </h3>
              {user.district ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-600 leading-snug">
                    {[user.village, user.district, user.state].filter(Boolean).join(", ")}
                    {user.pincode ? ` - ${user.pincode}` : ""}
                  </p>
                  <button
                    onClick={handleOpenLocationModal}
                    className="text-xs font-bold text-[#1B5E20] hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    Add your address to see delivery fees and farmers near you.
                  </p>
                  <button
                    onClick={handleOpenLocationModal}
                    className="w-full bg-[#F1F8E9] hover:bg-[#E3F2D5] text-[#1B5E20] py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    Set your location
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>
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
                    const crop = cartCrops[id];
                    if (!crop) return null;
                    return (
                      <div key={id} className="flex justify-between items-center border-b border-gray-50 pb-3">
                        <div>
                          <p className="text-sm font-bold text-[#212121]">{getCropName(crop)}</p>
                          <p className="text-xs text-[#2E7D32] font-semibold">₹{(Number(crop.basePricePerKg) * 1.20).toFixed(2)}/kg × {qty}kg</p>
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
                    <span>₹{totalCartPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                    <span>Est. Delivery Fee</span>
                    <span>{deliveryCoords ? `₹${totalDeliveryFee.toFixed(2)}` : "Needs your location"}</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between text-sm font-extrabold text-[#212121]">
                    <span>Total Amount</span>
                    <span>₹{(totalCartPrice + totalDeliveryFee).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod("ONLINE")}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${paymentMethod === "ONLINE" ? "border-[#1B5E20] bg-green-50/50 text-[#1B5E20]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      💳 Pay Online
                    </button>
                    <button
                      onClick={() => setPaymentMethod("COD")}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${paymentMethod === "COD" ? "border-[#1B5E20] bg-green-50/50 text-[#1B5E20]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      💵 Cash on Delivery
                    </button>
                  </div>
                  {onlineNeedsOneCrop && (
                    <p className="mt-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-700">
                      Online payment works for one crop at a time. Remove the other crops from your basket, or choose Cash on Delivery.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={onlineNeedsOneCrop || placingOrder}
                  className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#1B5E20]"
                >
                  {placingOrder
                    ? <><Loader2 size={16} className="animate-spin" /> Placing order...</>
                    : <>Confirm Order & Checkout <ChevronRight size={16} /></>}
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

      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#212121]">Change Location</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider">Address Details</h3>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-100 transition-colors cursor-pointer"
                >
                  {locationLoading ? 'Locating...' : 'Auto Detect GPS'}
                </button>
              </div>
              {errorMsg && (
                <div className="text-red-500 text-xs font-semibold mb-4">{errorMsg}</div>
              )}
              <LocationSelector
                value={locationData}
                onChange={setLocationData}
                showVillage={true}
                showPincode={true}
                label="Location / Address"
              />
            </div>
            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 shrink-0">
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={isUpdatingLocation}
                className="px-6 py-2.5 text-sm font-bold bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isUpdatingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function BuyerDashboard() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    }>
      <BuyerDashboardContent />
    </Suspense>
  );
}
