"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Script from "next/script";
import { ArrowLeft, Star, ShieldCheck, Leaf, Package, Truck, Minus, Plus, MapPin, Clock, TrendingUp, ShoppingBasket, IndianRupee, CreditCard, Banknote } from "lucide-react";
import Image from "next/image";

export default function CropDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const cropId = params.id as string;

  const [crop, setCrop] = useState<any>(null);
  const [loadingCrop, setLoadingCrop] = useState(true);
  const [quantity, setQuantity] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("ONLINE");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cropLang, setCropLang] = useState<"en" | "hi">("en");

  useEffect(() => {
    const saved = localStorage.getItem("cropline_crop_lang");
    if (saved === "en" || saved === "hi") {
      setCropLang(saved);
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchCropDetails = async () => {
      try {
        setLoadingCrop(true);
        const res = await api.get(`/crops/${cropId}`);
        if (res.data.success) {
          const fetchedCrop = res.data.data;
          setCrop(fetchedCrop);
          setQuantity(Number(fetchedCrop.minOrderKg) || 1);
          setDeliveryAddress(user?.village ? `${user.village}, ${user.district}, ${user.state}` : "");
        }
      } catch (err) {
        console.error("Failed to fetch crop", err);
      } finally {
        setLoadingCrop(false);
      }
    };
    if (user && cropId) {
      fetchCropDetails();
    }
  }, [user, cropId]);

  if (loading || loadingCrop) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  if (!crop) {
    return (
      <div className="min-h-screen bg-[#FAFBFA] flex flex-col items-center justify-center font-[family-name:var(--font-poppins)]">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Crop Not Found</h2>
        <button onClick={() => router.push("/dashboard/buyer")} className="mt-4 px-6 py-2 bg-[#1B5E20] text-white rounded-lg font-bold">Back to Marketplace</button>
      </div>
    );
  }

  // Calculations
  const basePrice = Number(crop.basePricePerKg) || 0;
  const marketPrice = Number(crop.marketPrice) || basePrice;
  const quantityKg = quantity;
  const cropCost = basePrice * quantityKg;
  
  let discountAmount = 0;
  if (crop.offer && quantityKg >= Number(crop.offer.minQuantityKg)) {
    discountAmount = (cropCost * Number(crop.offer.discountPercentage)) / 100;
  }
  
  const platformFee = (cropCost - discountAmount) * 0.05;
  const deliveryFee = 50; // Mock base estimated delivery fee
  const total = cropCost - discountAmount + platformFee + deliveryFee;

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => {
      const newVal = prev + delta;
      if (newVal < Number(crop.minOrderKg)) return Number(crop.minOrderKg);
      if (newVal > Number(crop.quantityRemainingKg)) return Number(crop.quantityRemainingKg);
      return newVal;
    });
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress) {
      alert("Please provide a delivery address");
      return;
    }
    try {
      setProcessing(true);
      
      // Create Order
      const orderRes = await api.post("/orders", {
        cropId: crop.id,
        quantityKg,
        deliveryType: "DELIVERY",
        paymentType: paymentMethod === "ONLINE" ? "ONLINE" : "CASH_ON_PICKUP", // COD acts as CASH_ON_PICKUP
        deliveryLatitude: 26.9124, // Mock lat
        deliveryLongitude: 75.7873, // Mock lng
        deliveryAddress
      });

      if (!orderRes.data.success) {
        throw new Error(orderRes.data.message);
      }

      const orderId = orderRes.data.data.id;

      if (paymentMethod === "ONLINE") {
        // Initiate Razorpay Payment
        const payRes = await api.post(`/payments/order/${orderId}/initiate`);
        if (payRes.data.success) {
          const { providerOrderId, amount, currency } = payRes.data.data;
          
          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: amount,
            currency: currency,
            name: "CropLine",
            description: `Order for ${crop.catalog?.englishName || "Crop"}`,
            order_id: providerOrderId,
            handler: function(response: any) {
              // Usually handled by webhook, but we redirect on frontend success
              router.push(`/dashboard/buyer/orders/${orderId}`);
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
        }
      } else {
        // COD - redirect directly to order page
        router.push(`/dashboard/buyer/orders/${orderId}`);
      }
    } catch (err: any) {
      console.error("Order error:", err);
      alert(err?.response?.data?.message || err.message || "Failed to place order.");
      setProcessing(false);
    }
  };

  const addToBasket = () => {
    const existingCart = JSON.parse(localStorage.getItem('cropline_cart') || '{}');
    existingCart[crop.id] = (existingCart[crop.id] || 0) + quantity;
    localStorage.setItem('cropline_cart', JSON.stringify(existingCart));
    alert(`${quantity} kg added to basket!`);
  };

  return (
    <div className="min-h-screen bg-[#FAFBFA] font-[family-name:var(--font-poppins)] text-[#212121] pb-20">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard/buyer")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-[#1B5E20]">Crop Details</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column - Details */}
        <div className="flex-1 space-y-8">
          
          {/* Images */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="aspect-[4/3] w-full bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden relative mb-4">
              {crop.photos && crop.photos.length > 0 ? (
                <Image src={crop.photos[0]} alt="Crop" fill className="object-cover" />
              ) : (
                <Leaf className="w-32 h-32 text-gray-200" />
              )}
            </div>
            {crop.photos && crop.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {crop.photos.map((photo: string, idx: number) => (
                  <div key={idx} className="w-20 h-20 shrink-0 bg-gray-100 rounded-xl relative overflow-hidden">
                    <Image src={photo} alt="Crop thumbnail" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crop Info */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -z-10 opacity-50"></div>
            
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                  {crop.catalog?.category || "Crop"}
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-[#1B5E20] leading-tight">
                  {cropLang === "hi" ? (crop.catalog?.hindiName || crop.catalog?.englishName || crop.cropName) : (crop.catalog?.englishName || crop.cropName)}
                </h1>
                <p className="text-lg text-gray-500 font-medium mb-4">
                  {cropLang === "hi" ? (crop.catalog?.englishName || crop.cropName) : crop.catalog?.hindiName}
                </p>
              </div>
              <div className="text-right">
                {crop.isPreHarvest ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold">
                    <Clock size={16} /> Pre-Harvest
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-sm font-bold">
                    <Leaf size={16} /> Harvested
                  </div>
                )}
                {crop.harvestDate && (
                  <p className="text-xs text-gray-400 mt-2 font-semibold">
                    Date: {new Date(crop.harvestDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 py-5 border-y border-gray-50 my-5">
              <div>
                <p className="text-sm font-bold text-gray-400 mb-1">Farmer Price</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-[#212121]">₹{basePrice}</span>
                  <span className="text-gray-500 font-semibold mb-1">/ kg</span>
                </div>
              </div>
              
              <div className="w-px h-12 bg-gray-100 hidden sm:block"></div>
              
              <div>
                <p className="text-sm font-bold text-gray-400 mb-1 flex items-center gap-1">
                  <TrendingUp size={14} /> Market Avg
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold text-gray-500">₹{marketPrice}</span>
                  <span className="text-gray-400 font-semibold mb-0.5">/ kg</span>
                </div>
              </div>
              
              {basePrice < marketPrice && (
                <div className="ml-auto bg-[#1B5E20] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm">
                  ₹{marketPrice - basePrice}/kg Cheaper!
                </div>
              )}
            </div>

            <div className="prose prose-sm text-gray-600 max-w-none">
              <h3 className="text-lg font-bold text-[#212121] mb-2">Description</h3>
              <p>{crop.description || "Freshly sourced from local farms with guaranteed quality."}</p>
            </div>
          </div>

          {/* Farmer Info */}
          <div 
            onClick={() => router.push(`/dashboard/buyer/farmer/${crop.farmerId}`)}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5 cursor-pointer hover:border-[#1B5E20] hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-3xl">👨‍🌾</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[#1B5E20] hover:underline">{crop.farmer?.name || "Farmer"}</h3>
                {crop.farmer?.isVerified && (
                  <ShieldCheck size={18} className="text-blue-500" />
                )}
              </div>
              <p className="text-gray-500 text-sm font-medium flex items-center gap-1 mt-1">
                <MapPin size={14} /> {crop.farmer?.village}, {crop.farmer?.district}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-[#FFC107]">
                <Star size={18} fill="currentColor" />
                <span className="font-bold text-[#212121]">{crop.farmer?.rating || "4.5"}</span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-1">{crop.farmer?.ratingCount || 0} reviews</p>
            </div>
          </div>

        </div>

        {/* Right Column - Order Panel */}
        <div className="lg:w-[400px] shrink-0">
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-lg sticky top-28">
            <h2 className="text-xl font-black text-[#1B5E20] mb-6">Order Details</h2>

            {crop.offer && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl mb-6 flex items-start gap-3">
                <Package className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-bold text-yellow-800">Bulk Discount Available!</p>
                  <p className="text-xs text-yellow-700 font-medium mt-0.5">
                    Order {crop.offer.minQuantityKg}+ kg to get {crop.offer.discountPercentage}% off your crop cost.
                  </p>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                <span>Quantity (kg)</span>
                <span className="text-[#1B5E20]">{crop.quantityRemainingKg} kg available</span>
              </div>
              <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1">
                <button 
                  onClick={() => handleQuantityChange(-1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-red-500 disabled:opacity-50"
                  disabled={quantity <= Number(crop.minOrderKg)}
                >
                  <Minus size={18} />
                </button>
                <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      if (val > Number(crop.quantityRemainingKg)) setQuantity(Number(crop.quantityRemainingKg));
                      else if (val < Number(crop.minOrderKg)) setQuantity(Number(crop.minOrderKg));
                      else setQuantity(val);
                    }
                  }}
                  className="flex-1 text-center bg-transparent font-black text-xl text-[#212121] outline-none"
                />
                <button 
                  onClick={() => handleQuantityChange(1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-green-500 disabled:opacity-50"
                  disabled={quantity >= Number(crop.quantityRemainingKg)}
                >
                  <Plus size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-400 font-medium text-center mt-2">
                Min order: {crop.minOrderKg} kg
              </p>
            </div>

            {/* Address */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-600 mb-2">Delivery Address</label>
              <textarea 
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] resize-none"
                rows={3}
                placeholder="Enter complete delivery address..."
              ></textarea>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-600 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod("ONLINE")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === "ONLINE" 
                      ? "border-[#1B5E20] bg-[#1B5E20] text-white shadow-md" 
                      : "border-gray-200 bg-white text-gray-500 hover:border-[#1B5E20]/50"
                  }`}
                >
                  <CreditCard size={20} className="mb-1" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pay Online</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod("COD")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === "COD" 
                      ? "border-[#1B5E20] bg-[#1B5E20] text-white shadow-md" 
                      : "border-gray-200 bg-white text-gray-500 hover:border-[#1B5E20]/50"
                  }`}
                >
                  <Banknote size={20} className="mb-1" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pay on Delivery</span>
                </button>
              </div>
            </div>

            {/* Bill */}
            <div className="bg-gray-50 p-4 rounded-2xl mb-6 space-y-3 text-sm font-medium">
              <div className="flex justify-between text-gray-600">
                <span>Crop Cost ({quantity} kg × ₹{basePrice})</span>
                <span>₹{cropCost.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Bulk Discount</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Platform Fee (5%)</span>
                <span>₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Est. Delivery</span>
                <span>₹{deliveryFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-gray-200 my-2"></div>
              <div className="flex justify-between text-xl font-black text-[#1B5E20]">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button 
                onClick={handlePlaceOrder}
                disabled={processing}
                className="w-full py-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl font-black text-lg shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {processing ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Place Order <ChevronRight size={20} /></>
                )}
              </button>
              <button 
                onClick={addToBasket}
                disabled={processing}
                className="w-full py-3 bg-white border-2 border-[#1B5E20] text-[#1B5E20] hover:bg-green-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBasket size={18} /> Add to Basket
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

function ChevronRight({ size = 24, ...props }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
