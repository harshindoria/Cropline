"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Navigation, CheckCircle2, TrendingUp, AlertCircle, Leaf, User, LogOut, 
  MapPin, ShoppingBag, Truck, Calendar, Wallet, Check
} from "lucide-react";

export default function DeliveryDashboard() {
  const { user, logout, switchRole, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"available" | "active">("available");
  
  // Mock delivery jobs
  const [availableJobs, setAvailableJobs] = useState([
    { id: "job1", farmerName: "Kisan Singh", pickupVillage: "Kalyanpura", buyerName: "Rahul Sharma", dropDistrict: "Jaipur", weight: "200 kg", distance: "4.8 km", fee: 180 },
    { id: "job2", farmerName: "Rajesh Kumar", pickupVillage: "Rampur", buyerName: "Sohan Lal", dropDistrict: "Ajmer Rd, Jaipur", weight: "50 kg", distance: "12.2 km", fee: 420 },
  ]);

  const [activeJobs, setActiveJobs] = useState([
    { id: "job3", farmerName: "Sohan Lal", pickupVillage: "Harinagar", buyerName: "Jaipur Retail Store", dropDistrict: "Mansarovar, Jaipur", weight: "500 kg", distance: "8.5 km", fee: 350, status: "ASSIGNED", pickupOtp: "5612", dropOtp: "8920" },
  ]);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "DELIVERY")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  const handleAcceptJob = (jobId: string) => {
    const jobToAccept = availableJobs.find(j => j.id === jobId);
    if (!jobToAccept) return;
    
    // Add to active jobs
    setActiveJobs([...activeJobs, { 
      ...jobToAccept, 
      status: "ASSIGNED", 
      pickupOtp: "1234", 
      dropOtp: "5678" 
    }]);
    
    // Remove from available
    setAvailableJobs(prev => prev.filter(j => j.id !== jobId));
    alert("Job accepted! Head to the farm location for pickup.");
  };

  const handlePickupComplete = (jobId: string) => {
    setActiveJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "PICKED_UP" } : j));
    alert("Crop picked up from farmer! Status updated to In Transit.");
  };

  const handleDeliveryComplete = (jobId: string) => {
    // Remove from active
    setActiveJobs(prev => prev.filter(j => j.id !== jobId));
    alert("Order delivered successfully to buyer! Fee credited to your wallet.");
  };

  return (
    <div className="min-h-screen bg-[#F9FAF7] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-green-100 flex flex-col justify-between p-6 shrink-0 hidden md:flex">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1B5E20] rounded-xl flex items-center justify-center">
              <Leaf className="w-4.5 h-4.5 text-[#FFC107]" fill="#FFC107" />
            </div>
            <span className="text-lg font-bold text-[#1B5E20] font-[family-name:var(--font-poppins)]">
              Crop<span className="text-[#FFC107]">Line</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">My Spaces</div>
            <button 
              onClick={() => switchRole("BUYER")}
              className="w-full flex items-center gap-3 hover:bg-gray-50 text-gray-600 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
            >
              🛒 Switch to Buyer
            </button>
            {user.roles.includes("FARMER") && (
              <button 
                onClick={() => switchRole("FARMER")}
                className="w-full flex items-center gap-3 hover:bg-gray-50 text-gray-600 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              >
                🌾 Switch to Farmer
              </button>
            )}
            <button className="w-full flex items-center gap-3 bg-[#E8F5E9] text-[#1B5E20] rounded-xl px-3 py-2.5 text-sm font-bold">
              🛵 Delivery Dashboard
            </button>
            {user.roles.includes("ADMIN") && (
              <button 
                onClick={() => switchRole("ADMIN")}
                className="w-full flex items-center gap-3 hover:bg-red-50 text-red-600 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors mt-2"
              >
                🔑 Admin Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#F1F8E9] rounded-2xl p-4 border border-green-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
              <User className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[#212121] truncate">{user.name || "Delivery Guy"}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email || user.phone}</p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-600 border border-red-100 hover:bg-red-50 py-3 rounded-xl transition-all"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-[#212121] font-[family-name:var(--font-poppins)]">
              Delivery Partner Hub
            </h1>
            <p className="text-[#757575] text-sm mt-1">Accept delivery jobs, track routes from farm to buyer, and verify pickup with OTPs.</p>
          </div>

          {/* Top Info Badges */}
          <div className="flex gap-3">
            <div className="bg-[#E8F5E9] border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#1B5E20]" />
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Delivery Earnings</p>
                <p className="text-sm font-extrabold text-[#1B5E20]">₹{user.walletBalance}</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Truck className="w-5 h-5 text-[#FFC107]" />
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Vehicle Type</p>
                <p className="text-sm font-extrabold text-gray-700">{user.vehicleType || "BIKE"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 mb-8 gap-6">
          <button 
            onClick={() => setActiveTab("available")}
            className={`pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "available" ? "border-[#1B5E20] text-[#1B5E20]" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Available Jobs Nearby ({availableJobs.length})
          </button>
          <button 
            onClick={() => setActiveTab("active")}
            className={`pb-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === "active" ? "border-[#1B5E20] text-[#1B5E20]" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            My Active Deliveries ({activeJobs.length})
          </button>
        </div>

        {/* Tab 1: Available Jobs */}
        {activeTab === "available" && (
          <div className="space-y-4">
            {availableJobs.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-gray-100 text-center text-gray-400 py-20 font-semibold">
                📭 No new delivery jobs available in your coverage radius right now.
              </div>
            ) : (
              availableJobs.map(job => (
                <div key={job.id} className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Job: {job.id}</span>
                      <span className="text-[10px] bg-green-50 text-[#2E7D32] px-2 py-0.5 rounded font-black">{job.weight}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#212121]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1B5E20]" />
                        <span>Khet: {job.pickupVillage}</span>
                      </div>
                      <span className="text-gray-300 font-bold">→</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#212121]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFC107]" />
                        <span>Drop: {job.dropDistrict}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 font-semibold mt-1">
                      Distance: <span className="text-gray-700 font-bold">{job.distance}</span> | Farmer: {job.farmerName}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 w-full md:w-auto justify-between border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase text-right">Payout Fee</p>
                      <p className="text-lg font-extrabold text-[#2E7D32] text-right">₹{job.fee}</p>
                    </div>
                    <button 
                      onClick={() => handleAcceptJob(job.id)}
                      className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      <Check size={14} strokeWidth={3} /> Accept Delivery
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Active Jobs */}
        {activeTab === "active" && (
          <div className="space-y-6">
            {activeJobs.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-gray-100 text-center text-gray-400 py-20 font-semibold">
                🛵 You don&apos;t have any active deliveries. Go to the Available tab to accept jobs!
              </div>
            ) : (
              activeJobs.map(job => (
                <div key={job.id} className="bg-white border border-green-100 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-4 flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">ID: {job.id}</span>
                        <span className="text-xs font-bold text-[#1B5E20] bg-green-50 px-2.5 py-0.5 rounded">{job.weight}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-[#212121] mt-1 flex items-center gap-1.5 font-[family-name:var(--font-poppins)]">
                        <ShoppingBag size={16} className="text-[#2E7D32]" /> Farm Delivery: ₹{job.fee} Payout
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold">
                      <span className="text-gray-400">Status: </span>
                      <span className={`px-2.5 py-1 rounded-full uppercase ${
                        job.status === "ASSIGNED" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-orange-50 text-orange-600 border border-orange-100"
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </div>

                  {/* Route Map Steps */}
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-green-150">
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-4 h-4 bg-[#1B5E20] border-2 border-white rounded-full shadow" />
                      <p className="text-xs font-bold text-[#212121]">Farmer Pickup: {job.farmerName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Village: {job.pickupVillage}</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-4 h-4 bg-[#FFC107] border-2 border-white rounded-full shadow" />
                      <p className="text-xs font-bold text-[#212121]">Buyer Dropoff: {job.buyerName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Address: {job.dropDistrict}</p>
                    </div>
                  </div>

                  {/* OTP Verification & Actions */}
                  <div className="bg-gray-50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    {job.status === "ASSIGNED" ? (
                      <>
                        <div className="text-xs font-bold text-gray-500">
                          🔑 Handover OTP for Farmer: <span className="bg-[#FFF9C4] text-[#FFC107] px-2 py-0.5 rounded font-black text-sm">{job.pickupOtp}</span>
                        </div>
                        <button 
                          onClick={() => handlePickupComplete(job.id)}
                          className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                        >
                          Confirm Farm Pickup Complete
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-gray-500">
                          🔑 Handover OTP for Buyer: <span className="bg-green-100 text-[#2E7D32] px-2 py-0.5 rounded font-black text-sm">{job.dropOtp}</span>
                        </div>
                        <button 
                          onClick={() => handleDeliveryComplete(job.id)}
                          className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                        >
                          Confirm Handed over to Buyer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
