"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { ArrowLeft, Package, Truck, CreditCard, Banknote, Star, ShieldCheck, MapPin, Phone, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import Image from "next/image";

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  ASSIGNED: { label: 'Delivery Assigned', color: 'text-purple-700', bg: 'bg-purple-100' },
  PICKED_UP: { label: 'Picked Up', color: 'text-violet-700', bg: 'bg-violet-100' },
  IN_DELIVERY: { label: 'On the Way', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  DELIVERED: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
  DISPUTED: { label: 'Disputed', color: 'text-orange-700', bg: 'bg-orange-100' },
};

export default function OrderDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cropLang, setCropLang] = useState<"en" | "hi">("en");

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingTargetId, setRatingTargetId] = useState("");
  const [ratingTargetType, setRatingTargetType] = useState<"FARMER" | "DELIVERY">("FARMER");
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cropline_crop_lang");
    if (saved === "en" || saved === "hi") {
      setCropLang(saved);
    }
  }, []);

  const fetchOrder = async () => {
    try {
      setLoadingOrder(true);
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error("Failed to fetch order", err);
    } finally {
      setLoadingOrder(false);
    }
  };

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && orderId) {
      fetchOrder();
    }
  }, [user, orderId]);

  if (loading || loadingOrder) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAFBFA] flex flex-col items-center justify-center font-[family-name:var(--font-poppins)]">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Order Not Found</h2>
        <button onClick={() => router.push("/dashboard/buyer/orders")} className="mt-4 px-6 py-2 bg-[#1B5E20] text-white rounded-lg font-bold">Back to Orders</button>
      </div>
    );
  }

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      setProcessing(true);
      const res = await api.patch(`/orders/${orderId}/cancel`);
      if (res.data.success) {
        alert("Order cancelled successfully");
        fetchOrder();
      }
    } catch (err: any) {
      console.error("Failed to cancel order", err);
      alert(err.response?.data?.message || "Failed to cancel order");
      setProcessing(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRating(true);
      const res = await api.post('/reviews', {
        orderId: order.id,
        targetId: ratingTargetId,
        targetType: ratingTargetType,
        rating: ratingValue,
        comment: ratingComment
      });
      if (res.data.success) {
        alert("Review submitted successfully!");
        setShowRatingModal(false);
        setRatingComment("");
        setRatingValue(5);
      }
    } catch (err: any) {
      console.error("Failed to submit review", err);
      alert(err.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingRating(false);
    }
  };

  const statusObj = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
  const crop = order.crop;
  const photoUrl = crop?.photos?.[0] || crop?.images?.[0]?.url;

  // Determine current step index in the timeline
  const currentStepIndex = STATUS_ORDER.indexOf(order.status);
  
  const getStepStatus = (index: number) => {
    if (order.status === 'CANCELLED') {
      return index === 0 ? 'completed' : 'cancelled'; // If cancelled, only first step is complete
    }
    if (currentStepIndex === -1) return 'pending'; // Unknown status
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  const timelineSteps = [
    { label: "Order Placed", date: order.createdAt },
    { label: "Farmer Confirmed", date: order.farmerAcceptedAt },
    { label: "Ready for Pickup", date: null },
    { label: "Delivery Assigned", date: null },
    { label: "Picked Up", date: null },
    { label: "On the Way", date: null },
    { label: "Delivered", date: order.completedAt }
  ];

  return (
    <div className="min-h-screen bg-[#FAFBFA] font-[family-name:var(--font-poppins)] text-[#212121] pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dashboard/buyer/orders")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-[#1B5E20] leading-tight">Order #{order.id.slice(-6).toUpperCase()}</h1>
              <p className="text-xs text-gray-500 font-semibold">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${statusObj.bg} ${statusObj.color}`}>
            {statusObj.label}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:py-8 flex flex-col lg:flex-row gap-6">
        
        {/* Left Column - Main Details */}
        <div className="flex-1 space-y-6">
          
          {/* Order Items */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#212121] mb-4 flex items-center gap-2">
              <Package size={20} className="text-[#1B5E20]" /> Order Summary
            </h2>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
              <div className="w-24 h-24 bg-white rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
                {photoUrl ? (
                  <Image src={photoUrl} alt="Crop" fill className="object-cover" />
                ) : (
                  <span className="text-4xl">🌾</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-[#212121]">
                  {cropLang === "hi" ? (crop?.catalog?.hindiName || crop?.catalog?.englishName || crop?.cropName || "Crop") : (crop?.catalog?.englishName || crop?.cropName || "Crop")}
                </h3>
                <p className="text-sm font-semibold text-gray-500 mb-1">
                  {cropLang === "hi" ? (crop?.catalog?.englishName || crop?.cropName || "") : (crop?.catalog?.hindiName || "")}
                </p>
                <div className="text-sm font-bold text-[#1B5E20]">
                  {order.quantityKg} kg × ₹{order.basePricePerKg}/kg
                </div>
              </div>
            </div>

            {/* Bill Breakdown */}
            <div className="space-y-3 text-sm font-medium px-2">
              <div className="flex justify-between text-gray-600">
                <span>Crop Cost</span>
                <span>₹{Number(order.basePricePerKg) * Number(order.quantityKg)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Bulk Discount</span>
                  <span>-₹{Number(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Platform Fee</span>
                <span>₹{Number(order.platformFee)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>₹{Number(order.deliveryFee)}</span>
              </div>
              <div className="h-px bg-gray-200 my-4"></div>
              <div className="flex justify-between text-xl font-black text-[#1B5E20]">
                <span>Total Amount</span>
                <span>₹{order.totalBuyerPrice}</span>
              </div>
            </div>
          </div>

          {/* Farmer Info */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#212121] mb-4 flex items-center gap-2">
              <span className="text-2xl leading-none">👨‍🌾</span> Farmer Details
            </h2>
            <div className="flex items-start justify-between cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push(`/dashboard/buyer/farmer/${order.farmerId}`)}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-[#1B5E20] hover:underline">{order.farmer?.name || "Farmer"}</h3>
                  {order.farmer?.isVerified && <ShieldCheck size={16} className="text-blue-500" />}
                </div>
                <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5 mb-1">
                  <MapPin size={14} /> {order.farmer?.village}, {order.farmer?.district}
                </p>
                {order.status === 'DELIVERED' || order.status === 'COMPLETED' ? (
                  <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <Phone size={14} /> {order.farmer?.phone}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[#FFC107]">
                  <Star size={16} fill="currentColor" />
                  <span className="font-bold text-[#212121] text-sm">{order.farmer?.rating || "4.5"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          {order.deliveryType === 'DELIVERY' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-[#212121] mb-4 flex items-center gap-2">
                <Truck size={20} className="text-[#1B5E20]" /> Delivery Details
              </h2>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Delivery Address</p>
                <p className="text-sm font-semibold text-[#212121]">{order.deliveryAddress || "Address not provided"}</p>
              </div>

              {order.deliveryJob?.deliveryPartner && (
                <div className="flex items-center gap-4 mt-4 p-4 border border-green-100 bg-green-50/50 rounded-2xl">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-green-100">
                    🛵
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#212121]">{order.deliveryJob.deliveryPartner.name}</p>
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} /> {order.deliveryJob.deliveryPartner.phone}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <span className="inline-block px-2 py-1 bg-[#1B5E20] text-white text-[10px] font-bold rounded-lg uppercase">
                      {order.deliveryJob.deliveryPartner.vehicleType || "VEHICLE"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Status & Actions */}
        <div className="lg:w-[350px] shrink-0 space-y-6">
          
          {/* Timeline */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#212121] mb-6">Order Status</h2>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-200 before:to-gray-200">
              
              {order.status === 'CANCELLED' && (
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-red-100 text-red-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-1/2">
                    <XCircle size={16} />
                  </div>
                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] pl-8 md:pl-0">
                    <div className="flex flex-col">
                      <h4 className="text-sm font-bold text-red-600">Order Cancelled</h4>
                      {order.cancellationReason && (
                        <p className="text-xs font-medium text-gray-500 mt-1">{order.cancellationReason}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {timelineSteps.map((step, idx) => {
                const status = getStepStatus(idx);
                if (order.status === 'CANCELLED' && idx > 0) return null; // Hide future steps if cancelled

                return (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-1/2 transition-colors duration-300 ${
                      status === 'completed' ? 'bg-[#1B5E20] text-white' : 
                      status === 'current' ? 'bg-[#FFC107] text-[#1B5E20] animate-pulse' : 
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {status === 'completed' ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 rounded-full bg-current"></div>}
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] pl-8 md:pl-0">
                      <div className="flex flex-col">
                        <h4 className={`text-sm font-bold ${status === 'pending' ? 'text-gray-400' : 'text-[#212121]'}`}>
                          {step.label}
                        </h4>
                        {step.date && status === 'completed' && (
                          <p className="text-xs font-medium text-gray-400 mt-0.5">
                            {new Date(step.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#212121] mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-[#1B5E20]" /> Payment
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Method</p>
                <div className="flex items-center gap-2">
                  {order.paymentType === 'ONLINE' ? (
                    <><CreditCard size={16} className="text-gray-600" /> <span className="text-sm font-bold text-gray-700">Online Payment</span></>
                  ) : (
                    <><Banknote size={16} className="text-gray-600" /> <span className="text-sm font-bold text-gray-700">Cash on Delivery</span></>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                  {order.paymentRecord?.status || "PENDING"}
                </div>
                {order.paymentType === 'CASH_ON_PICKUP' && order.paymentRecord?.status !== 'RELEASED' && (
                  <p className="text-[10px] font-semibold text-gray-400 mt-2 flex items-start gap-1">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    Please pay the delivery partner upon arrival.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {order.status === 'PENDING' && (
            <button
              onClick={handleCancelOrder}
              disabled={processing}
              className="w-full py-4 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? <RefreshCw size={18} className="animate-spin" /> : <XCircle size={18} />}
              Cancel Order
            </button>
          )}

          {order.status !== 'PENDING' && (
            <div className="flex flex-col gap-3 mt-4">
              <button
                onClick={() => {
                  setRatingTargetId(order.farmerId);
                  setRatingTargetType('FARMER');
                  setShowRatingModal(true);
                }}
                className="w-full py-4 bg-white border-2 border-gray-100 text-[#1B5E20] hover:bg-green-50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Star size={18} /> Rate Farmer
              </button>
              {order.deliveryJob?.deliveryPartnerId && (
                <button
                  onClick={() => {
                    setRatingTargetId(order.deliveryJob.deliveryPartnerId);
                    setRatingTargetType('DELIVERY');
                    setShowRatingModal(true);
                  }}
                  className="w-full py-4 bg-white border-2 border-gray-100 text-[#1B5E20] hover:bg-green-50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Star size={18} /> Rate Delivery Partner
                </button>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#212121]">
                Rate {ratingTargetType === 'FARMER' ? 'Farmer' : 'Delivery Partner'}
              </h3>
              <button onClick={() => setShowRatingModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitRating} className="flex flex-col gap-4">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      size={40}
                      fill={star <= ratingValue ? "#FFC107" : "transparent"}
                      className={star <= ratingValue ? "text-[#FFC107]" : "text-gray-300"}
                    />
                  </button>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Review (Optional)</label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-[#1B5E20] focus:ring-0 resize-none h-24"
                ></textarea>
                <p className="text-xs text-gray-400 mt-1">If left blank, your rating will remain anonymous.</p>
              </div>

              <button
                type="submit"
                disabled={submittingRating}
                className="w-full bg-[#1B5E20] text-white py-4 rounded-xl font-bold mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingRating ? <RefreshCw size={18} className="animate-spin" /> : 'Submit Rating'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
