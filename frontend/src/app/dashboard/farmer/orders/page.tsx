"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { ArrowLeft, Package, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100' },
  READY_FOR_PICKUP: { label: 'Ready', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  ASSIGNED: { label: 'Assigned', color: 'text-purple-700', bg: 'bg-purple-100' },
  PICKED_UP: { label: 'Picked Up', color: 'text-violet-700', bg: 'bg-violet-100' },
  IN_DELIVERY: { label: 'On the Way', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  DELIVERED: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
  DISPUTED: { label: 'Disputed', color: 'text-orange-700', bg: 'bg-orange-100' },
};

const TABS = ["All", "Pending", "Confirmed", "In Delivery", "Delivered", "Completed", "Cancelled"];

export default function FarmerOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [cropLang, setCropLang] = useState<"en" | "hi">("en");

  useEffect(() => {
    const saved = localStorage.getItem("cropline_crop_lang");
    if (saved === "en" || saved === "hi") {
      setCropLang(saved);
    }
  }, []);

  const getCropName = (crop: any) => {
    if (cropLang === "hi" && crop?.catalog?.hindiName) {
      return crop.catalog.hindiName;
    }
    return crop?.cropName || crop?.catalog?.englishName || "Crop";
  };

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "FARMER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const res = await api.get("/orders");
        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      } catch (err) {
        console.error("Failed to fetch orders", err);
      } finally {
        setLoadingOrders(false);
      }
    };
    if (user) {
      fetchOrders();
    }
  }, [user]);

  if (loading || loadingOrders) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === "All") return true;
    if (activeTab === "Pending") return order.status === "PENDING";
    if (activeTab === "Confirmed") return order.status === "CONFIRMED" || order.status === "READY_FOR_PICKUP" || order.status === "ASSIGNED" || order.status === "PICKED_UP";
    if (activeTab === "In Delivery") return order.status === "IN_DELIVERY";
    if (activeTab === "Delivered") return order.status === "DELIVERED";
    if (activeTab === "Completed") return order.status === "COMPLETED";
    if (activeTab === "Cancelled") return order.status === "CANCELLED" || order.status === "DISPUTED";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAFBFA] font-[family-name:var(--font-poppins)] text-[#212121]">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dashboard/farmer")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-[#1B5E20]">Incoming Orders</h1>
          </div>
          <div className="text-sm font-semibold text-gray-500">
            {orders.length} orders
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:py-8">
        
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none mb-4">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeTab === tab 
                  ? "bg-[#1B5E20] text-white shadow-md" 
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Order List */}
        <div className="space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => {
              const status = STATUS_CONFIG[order.status] || { label: order.status, color: "text-gray-700", bg: "bg-gray-100" };
              const crop = order.crop;
              const photoUrl = crop?.photos?.[0] || crop?.images?.[0]?.url;
              
              const expiryDate = new Date(new Date(order.createdAt).getTime() + 6 * 60 * 60 * 1000);
              const msLeft = expiryDate.getTime() - Date.now();
              const hoursLeft = Math.floor(Math.max(0, msLeft) / (1000 * 60 * 60));
              const minsLeft = Math.floor((Math.max(0, msLeft) % (1000 * 60 * 60)) / (1000 * 60));
              const isExpired = msLeft <= 0;
              
              return (
                <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative border border-gray-100">
                      {photoUrl ? (
                        <Image src={photoUrl} alt="Crop" fill className="object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="text-3xl">🌾</span>
                      )}
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-bold text-[#212121] truncate">
                          {getCropName(crop)}
                        </h3>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      
                      <div className="text-sm font-semibold text-gray-500 mb-1">
                        {order.quantityKg} kg × ₹{order.basePricePerKg}/kg
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs font-medium text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-[#1B5E20]">₹{order.totalBuyerPrice}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {order.status === "PENDING" && !isExpired && (
                    <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                      <div className="text-xs font-bold text-red-500 animate-pulse">
                        ⏳ {hoursLeft}h {minsLeft}m left to respond
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                             api.patch(`/orders/${order.id}/reject`).then(() => window.location.reload());
                          }}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => {
                             api.patch(`/orders/${order.id}/confirm`).then(() => window.location.reload());
                          }}
                          className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#1B5E20] hover:bg-[#2E7D32]"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  )}
                  {order.status === "PENDING" && isExpired && (
                    <div className="border-t border-gray-100 pt-3 text-xs font-bold text-red-500">
                      Expired
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
              <Package className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-[#212121] mb-2">No orders found</h3>
              <p className="text-sm text-gray-500 font-medium max-w-sm mb-6">
                You don't have any incoming orders that match the selected filter.
              </p>
              <button 
                onClick={() => router.push("/dashboard/farmer")}
                className="px-6 py-2 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-full font-bold shadow-md transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
