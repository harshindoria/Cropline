"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Leaf, Home, ShoppingBag, Truck, Wallet, Star, User, Settings, HelpCircle,
  Search, Bell, ChevronDown, CheckCircle2, Navigation, AlertCircle, ArrowRight,
  MapPin
} from "lucide-react";

import api from "@/lib/axios";

export default function DeliveryDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [monthlyEarnings, setMonthlyEarnings] = useState<number[]>(new Array(12).fill(0));
  const [summary, setSummary] = useState({
    todayEarnings: 0,
    completedJobs: 0,
    totalDistanceKm: 0,
    avgTimeMins: 0,
    dailyGoal: 2000
  });
  const [nearbyActivity, setNearbyActivity] = useState({ within5: 0, within10: 0, priority: 0 });
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [isGoalFlipped, setIsGoalFlipped] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if(user && 'isOnline' in user) {
      setIsOnline(user.isOnline as boolean);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user?.latitude || !user?.longitude) return;

      const [monthlyRes, summaryRes, nearbyRes, notificationsRes] = await Promise.all([
        api.get("/delivery/stats/monthly"),
        api.get("/delivery/stats/summary"),
        api.get(`/delivery/nearby?lat=${user.latitude}&lng=${user.longitude}`),
        api.get("/notifications")
      ]);

      if (monthlyRes.data.success) setMonthlyEarnings(monthlyRes.data.data);
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
        setNewGoalInput(summaryRes.data.data.dailyGoal.toString());
      }
      if (nearbyRes.data.success) {
        let within5 = 0;
        let within10 = 0;
        let priority = 0; // high priority if crop is pre-harvest or urgency
        nearbyRes.data.data.forEach((job: any) => {
          if (job.distance <= 5) within5++;
          else if (job.distance <= 10) within10++;
          if (job.isPriority) priority++;
        });
        setNearbyActivity({ within5, within10, priority });
      }
      if (notificationsRes.data.success) setRecentUpdates(notificationsRes.data.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "DELIVERY")) {
      router.push("/dashboard");
    } else if (user?.activeRole === "DELIVERY") {
      fetchData();
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  return (
    <>
      {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search deliveries, orders..."
              className="w-full bg-gray-50 rounded-full pl-11 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-100 transition-shadow"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-6">

            <div className="relative cursor-pointer group">
              <Bell className="text-gray-500 group-hover:text-gray-700 transition-colors" size={22} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">3</div>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-100 cursor-pointer group">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden border border-green-200">
                👨🏽‍
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-black text-[#212121]">{user.name || "Harsh Kumar"}</p>
                <p className="text-[11px] font-bold text-gray-400">Delivery Partner</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 group-hover:text-[#212121]" />
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#FAFBFA]">
          
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-[#E8F5E9] to-[#C8E6C9] rounded-3xl p-8 relative overflow-hidden border border-green-100/50 shadow-sm">
            <div className="relative z-10 max-w-lg">
              <h1 className="text-3xl font-black text-[#1B5E20] mb-2 flex items-center gap-2">
                Good Morning, {user.name?.split(' ')[0] || "Harsh"}! 👋
              </h1>
              <p className="text-[#2E7D32] font-medium mb-6">
                You're online and ready to deliver. <br/>
                <span className="font-bold">8 delivery requests</span> available near you.
              </p>
              <button className="bg-[#1B5E20] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#2E7D32] transition-colors flex items-center gap-2">
                View Available Deliveries <ArrowRight size={16} />
              </button>
            </div>
            
            {/* Banner Illustration (CSS Art/Emoji for now to match the vibe) */}
            <div className="absolute right-0 bottom-0 h-full w-1/2 opacity-90 pointer-events-none flex items-end justify-end pr-10 pb-2 overflow-visible">
               <div className="text-[160px] leading-none drop-shadow-xl -scale-x-100 rotate-[10deg]">🛵</div>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                  <ShoppingBag className="text-[#1B5E20]" size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Available Jobs</p>
                  <p className="text-3xl font-black text-[#212121]">{nearbyActivity.within5 + nearbyActivity.within10}</p>
                </div>
              </div>
              <p className="text-xs font-bold text-[#1B5E20]">Nearby</p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                  <CheckCircle2 className="text-blue-500" size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Deliveries Today</p>
                  <p className="text-3xl font-black text-[#212121]">{summary.completedJobs}</p>
                </div>
              </div>
              <p className="text-xs font-bold text-blue-500">Completed</p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <Wallet className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Today's Earnings</p>
                  <p className="text-3xl font-black text-[#212121]">₹{summary.todayEarnings}</p>
                </div>
              </div>
              <p className="text-xs font-bold text-emerald-600">Earnings for today</p>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center border border-purple-100">
                  <Wallet className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</p>
                  <p className="text-3xl font-black text-[#212121]">₹{user.walletBalance}</p>
                </div>
              </div>
              <p className="text-xs font-bold text-purple-600">Available to withdraw</p>
            </div>
          </div>

          {/* Row 2: Charts and Goal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Line Chart */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black text-[#212121]">Earnings Overview</h3>
                <div className="text-xs font-bold text-gray-500 flex items-center gap-1 cursor-pointer hover:text-gray-700 transition-colors">
                  This Month <ChevronDown size={14} />
                </div>
              </div>
              
              {/* Dummy SVG Line Chart */}
              <div className="relative h-48 w-full pr-2">
                {/* Y Axis Labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] font-bold text-gray-400 pb-6">
                  <span>₹2.5k</span>
                  <span>₹2k</span>
                  <span>₹1.5k</span>
                  <span>₹1k</span>
                  <span>₹500</span>
                  <span>₹0</span>
                </div>
                
                {/* Chart Area */}
                <div className="ml-10 h-full relative border-b border-gray-100 pb-6">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                    <div className="w-full border-b border-dashed border-gray-100"></div>
                  </div>
                  
                  {/* The Line & Area */}
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#4CAF50" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {(() => {
                      const maxEarning = Math.max(...monthlyEarnings, 1000); // minimum scale 1000
                      const points = monthlyEarnings.map((val, index) => {
                        const x = (index / 11) * 100;
                        const y = 100 - (val / maxEarning) * 100;
                        return { x, y };
                      });
                      
                      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const areaData = `${pathData} L 100 100 L 0 100 Z`;

                      return (
                        <>
                          <path d={areaData} fill="url(#chartGradient)" />
                          <path 
                            d={pathData} 
                            fill="none" 
                            stroke="#4CAF50" 
                            strokeWidth="2.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#4CAF50" strokeWidth="2" className="cursor-pointer hover:r-[5px] transition-all" />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  
                  {/* X Axis Labels */}
                  <div className="absolute -bottom-6 left-0 w-full flex justify-between text-[10px] font-bold text-gray-400">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                    <span>Jul</span>
                    <span>Aug</span>
                    <span>Sep</span>
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Goal Ring */}
            <div className="bg-transparent rounded-3xl [perspective:1000px] h-[300px]">
              <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isGoalFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                
                {/* Front Side */}
                <div className="absolute inset-0 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col [backface-visibility:hidden] cursor-pointer" onClick={() => setIsGoalFlipped(true)}>
                  <h3 className="text-sm font-black text-[#212121] mb-6">Today's Goal</h3>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                        <circle 
                          cx="50" cy="50" r="42" fill="none" stroke="#4CAF50" strokeWidth="8" strokeLinecap="round" 
                          strokeDasharray={`${2 * Math.PI * 42}`} 
                          strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(summary.todayEarnings / summary.dailyGoal, 1))}`} 
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-5xl font-black text-[#212121] tracking-tighter">{Math.round((summary.todayEarnings / summary.dailyGoal) * 100)}<span className="text-2xl">%</span></span>
                        <span className="text-[11px] font-bold text-gray-500 mt-2">₹{summary.todayEarnings} / ₹{summary.dailyGoal}</span>
                        <span className="text-[10px] font-black text-[#1B5E20] uppercase tracking-wider mt-1">Earnings Goal</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Back Side (Set Goal) */}
                <div className="absolute inset-0 bg-[#F1F8E9] rounded-3xl p-6 border border-green-100 shadow-sm flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-[#1B5E20]">Set New Goal</h3>
                    <div onClick={() => setIsGoalFlipped(false)} className="cursor-pointer text-gray-400 hover:text-[#1B5E20]">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <p className="text-xs font-bold text-gray-500 text-center">What's your target for today?</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-[#212121]">₹</span>
                      <input 
                        type="number"
                        value={newGoalInput}
                        onChange={(e) => setNewGoalInput(e.target.value)}
                        className="w-32 bg-white rounded-xl px-4 py-2 text-2xl font-black text-[#212121] text-center focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm border border-green-100"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await api.patch("/delivery/stats/goal", { goal: Number(newGoalInput) });
                          if(res.data.success) {
                            setSummary({...summary, dailyGoal: Number(newGoalInput)});
                            setIsGoalFlipped(false);
                          }
                        } catch (err) { console.error(err); }
                      }}
                      className="mt-2 bg-[#1B5E20] text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-green-800 transition-colors"
                    >
                      Save Goal
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Row 3: Summaries and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Today's Summary */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-[#212121] mb-6">Today's Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-green-50 rounded-2xl flex items-center justify-center mb-3 border border-green-100">
                    <CheckCircle2 size={20} className="text-[#1B5E20]" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{summary.completedJobs}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Completed</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-50 rounded-2xl flex items-center justify-center mb-3 border border-blue-100">
                    <Navigation size={20} className="text-blue-500" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{summary.totalDistanceKm} <span className="text-sm">km</span></p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Distance</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center mb-3 border border-orange-100">
                    <AlertCircle size={20} className="text-orange-500" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{summary.avgTimeMins} <span className="text-sm">mins</span></p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg. Time</p>
                </div>
              </div>
            </div>

            {/* Nearby Activity */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-[#212121]">Nearby Activity</h3>
                <ArrowRight size={16} className="text-gray-400 cursor-pointer hover:text-[#1B5E20] transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-2">
                    <MapPin size={16} className="text-green-500" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{nearbyActivity.within5}</p>
                  <p className="text-[11px] font-bold text-gray-400">within 5 km</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto bg-yellow-50 rounded-full flex items-center justify-center mb-2">
                    <MapPin size={16} className="text-yellow-500" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{nearbyActivity.within10}</p>
                  <p className="text-[11px] font-bold text-gray-400">within 10 km</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-2">
                    <Bell size={16} className="text-red-500" />
                  </div>
                  <p className="text-2xl font-black text-[#212121]">{nearbyActivity.priority}</p>
                  <p className="text-[11px] font-bold text-gray-400">High Priority</p>
                </div>
              </div>
              <button className="mt-auto w-full text-center text-xs font-black text-[#1B5E20] hover:underline flex justify-center items-center gap-1 group">
                View Available Deliveries <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Recent Updates */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-sm font-black text-[#212121] mb-5">Recent Updates</h3>
              
              <div className="space-y-6 mb-4">
                {recentUpdates.length > 0 ? recentUpdates.map((notification, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
                      <Bell size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className="text-[13px] font-bold text-[#212121]">{notification.title}</p>
                        <span className="text-[10px] font-bold text-gray-400">
                          {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">{notification.body}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-sm font-bold text-gray-400 py-6">No recent updates</div>
                )}
              </div>

              <button className="mt-auto w-full text-center text-xs font-black text-[#1B5E20] hover:underline flex justify-center items-center gap-1 group">
                View All Updates <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

        </div>
    </>
  );
}
