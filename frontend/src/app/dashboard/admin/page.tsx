"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  Search, Bell, ChevronDown, ShieldCheck, LayoutDashboard, 
  Users, FileText, AlertTriangle, MessageSquare, Check, X,
  TrendingUp, Activity, Leaf, User as UserIcon, CheckCircle2,
  Ban, Tractor, Truck, ArrowUp, ArrowDown, Calendar, ShoppingBag, IndianRupee, Sprout, Info, Clock, CreditCard, ArrowRight, CheckCircle, AlertCircle, FileCheck, Settings, ChevronRight
} from "lucide-react";
import BuyersTab from "./components/BuyersTab";

// Mock Data for tabs other than applications
const MOCK_METRICS = {
  totalRevenue: "₹1,24,500",
  activeUsers: 1245,
  pendingApps: 14,
  disputes: 3
};

const MOCK_USERS = [
  { id: "U101", name: "Harsh Indoria", role: "ADMIN", status: "ACTIVE", joined: "Jan 2024" },
  { id: "U102", name: "Ramesh Yadav", role: "BUYER", status: "ACTIVE", joined: "Feb 2024" },
  { id: "U103", name: "Vikram Singh", role: "FARMER", status: "BLOCKED", joined: "Mar 2024" },
];

const MOCK_COMPLAINTS = [
  { id: "C01", from: "Priya (Buyer)", against: "Vikram (Farmer)", reason: "Quality issue with Tomatoes", status: "OPEN" },
  { id: "C02", from: "Ramesh (Buyer)", against: "Suresh (Delivery)", reason: "Late delivery by 2 hours", status: "RESOLVED" },
];

type TabType = "overview" | "applications" | "users" | "complaints" | "notifications";

export default function AdminDashboard() {
  const { user, loading, switchRole, logout } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [isUsersExpanded, setIsUsersExpanded] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "ADMIN")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const [overviewData, setOverviewData] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Fetch Applications from Backend
  const fetchApplications = async () => {
    try {
      setLoadingApps(true);
      const res = await api.get("/admin/applications");
      if (res.data.success) {
        setApplications(res.data.applications || []);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoadingApps(false);
    }
  };

  // Fetch Overview Data from Backend
  const fetchOverview = async () => {
    try {
      setLoadingOverview(true);
      const res = await api.get("/admin/overview");
      if (res.data.success) {
        setOverviewData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    if (activeTab === "applications" && user?.activeRole === "ADMIN") {
      fetchApplications();
    }
    if (activeTab === "overview" && user?.activeRole === "ADMIN") {
      fetchOverview();
    }
  }, [activeTab, user]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  const handleRoleSwitch = (targetRole: string) => {
    setShowRoleDropdown(false);
    if (user.roles.includes(targetRole as any)) {
      switchRole(targetRole as any);
    }
  };

  const processApplication = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await api.patch(`/admin/applications/${id}`, { action });
      if (res.data.success) {
        setApplications(prev => prev.filter(app => app.id !== id));
        alert(`Application ${action.toLowerCase()}d successfully!`);
      }
    } catch (err) {
      console.error(`Failed to ${action} application:`, err);
      alert(`Error processing application.`);
    }
  };

  // --- SVG Line Chart Generator for Market Growth ---
  const renderMarketGrowthChart = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const revenueData = [120000, 140000, 175000, 220000, 250000, 300000];
    const ordersData = [80000, 100000, 130000, 150000, 160000, 220000];
    const usersData = [30000, 50000, 80000, 110000, 120000, 160000];

    const width = 600;
    const height = 250;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxVal = 300000;
    const range = maxVal;

    const createPath = (data: number[]) => {
      const points = data.map((val, index) => {
        const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
        const y = paddingTop + chartHeight - (val / range) * chartHeight;
        return { x, y };
      });

      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX1 = prev.x + (curr.x - prev.x) / 3;
        const cpY1 = prev.y;
        const cpX2 = prev.x + (2 * (curr.x - prev.x)) / 3;
        const cpY2 = curr.y;
        pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
      }
      return { pathD, points };
    };

    const ordersPath = createPath(ordersData);
    const revenuePath = createPath(revenueData);
    const usersPath = createPath(usersData);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Grid lines */}
        {[0, 0.166, 0.333, 0.5, 0.666, 0.833, 1].map((ratio, index) => {
          const y = paddingTop + ratio * chartHeight;
          const val = maxVal - ratio * range;
          return (
            <g key={index}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#F1F3F0" strokeWidth="1" strokeDasharray="3,3" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-bold text-gray-400">
                {val === 0 ? "0" : `${Math.round(val/1000)}K`}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        <path d={revenuePath.pathD} fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
        <path d={ordersPath.pathD} fill="none" stroke="#2196F3" strokeWidth="2.5" strokeLinecap="round" />
        <path d={usersPath.pathD} fill="none" stroke="#FF9800" strokeWidth="2.5" strokeLinecap="round" />

        {/* Data points */}
        {revenuePath.points.map((p, index) => (
          <circle key={`rev-${index}`} cx={p.x} cy={p.y} r="4" fill="#4CAF50" stroke="#FFFFFF" strokeWidth="2" />
        ))}
        {ordersPath.points.map((p, index) => (
          <circle key={`ord-${index}`} cx={p.x} cy={p.y} r="4" fill="#2196F3" stroke="#FFFFFF" strokeWidth="2" />
        ))}
        {usersPath.points.map((p, index) => (
          <circle key={`usr-${index}`} cx={p.x} cy={p.y} r="4" fill="#FF9800" stroke="#FFFFFF" strokeWidth="2" />
        ))}

        {/* X Axis labels */}
        {months.map((month, index) => (
          <text key={month} x={paddingLeft + (index / (months.length - 1)) * chartWidth} y={height - 8} textAnchor="middle" className="text-[10px] font-bold text-gray-400">
            {month}
          </text>
        ))}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex font-[family-name:var(--font-poppins)] text-[#212121]">
      
      {/* ── Sidebar (Light Theme) ── */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col hidden lg:flex shrink-0">
        <div className="p-6 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-8">
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
              <p className="text-sm font-bold text-gray-800 leading-tight">{user.name}</p>
              <p className="text-[10px] font-semibold text-[#1B5E20] uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          
          <div className="space-y-1">
            <button 
              onClick={() => setIsUsersExpanded(!isUsersExpanded)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab.startsWith("users") ? "bg-[#E8F5E9] text-[#1B5E20] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#1B5E20] font-bold"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-5 h-5 ${activeTab.startsWith("users") ? "text-[#1B5E20]" : "text-gray-400"}`} />
                <span className="text-sm">Users</span>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${isUsersExpanded ? "rotate-90" : ""} ${activeTab.startsWith("users") ? "text-[#1B5E20]" : "text-gray-400"}`} />
            </button>
            {isUsersExpanded && (
              <div className="pl-11 pr-4 py-2 space-y-2">
                <div onClick={() => setActiveTab("users-farmers")} className={`text-xs cursor-pointer font-bold transition-colors ${activeTab === "users-farmers" ? "text-[#1B5E20]" : "text-gray-400 hover:text-gray-600"}`}>Farmers</div>
                <div onClick={() => setActiveTab("users-buyers")} className={`text-xs cursor-pointer font-bold transition-colors ${activeTab === "users-buyers" ? "text-[#1B5E20]" : "text-gray-400 hover:text-gray-600"}`}>Buyers</div>
                <div onClick={() => setActiveTab("users-delivery")} className={`text-xs cursor-pointer font-bold transition-colors ${activeTab === "users-delivery" ? "text-[#1B5E20]" : "text-gray-400 hover:text-gray-600"}`}>Delivery Partners</div>
              </div>
            )}
          </div>

          <SidebarItem icon={FileCheck} label="Document Verification" active={activeTab === "applications"} onClick={() => setActiveTab("applications")} badge={applications.length > 0 ? applications.length : undefined} />
          <SidebarItem icon={Bell} label="Notifications" active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} />
          <SidebarItem icon={AlertTriangle} label="Complaints" active={activeTab === "complaints"} onClick={() => setActiveTab("complaints")} badge={1} />
          <SidebarItem icon={CreditCard} label="Transactions" active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
          <SidebarItem icon={Settings} label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white px-8 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h1 className="text-2xl font-black capitalize text-gray-800">{activeTab.replace("-", " ")}</h1>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 w-64"
              />
            </div>
            
            <button className="relative p-2 bg-gray-50 rounded-full cursor-pointer hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            {/* Role Switcher */}
            <div className="relative">
              <div 
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 cursor-pointer bg-gray-50 p-1.5 pr-4 rounded-full border border-gray-100 hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-[#1B5E20] text-white rounded-full flex items-center justify-center font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none">{user.name?.split(" ")[0] || "User"}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Admin</p>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
              </div>

              {/* Dropdown Menu */}
              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-gray-50 mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Switch Role</p>
                  </div>
                  
                  {user.roles.includes("BUYER") && (
                    <button onClick={() => handleRoleSwitch("BUYER")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      🛒 Buyer
                    </button>
                  )}
                  {user.roles.includes("FARMER") && (
                    <button onClick={() => handleRoleSwitch("FARMER")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      🌾 Farmer
                    </button>
                  )}
                  {user.roles.includes("DELIVERY") && (
                    <button onClick={() => handleRoleSwitch("DELIVERY")} className="w-full text-left px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                      🛵 Delivery Boy
                    </button>
                  )}
                  
                  <button onClick={() => handleRoleSwitch("ADMIN")} className="w-full text-left px-4 py-2 text-sm font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between border-t border-gray-50 mt-1 pt-2">
                    🛡️ Admin
                    <div className="w-3 h-3 rounded-full bg-[#1B5E20] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                  </button>
                  
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

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {activeTab === "users-buyers" && <BuyersTab />}
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Top Greeting */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-800">Good Morning, Admin 👋</h2>
                  <p className="text-sm font-semibold text-gray-500 mt-1">Here's what's happening on CropLine today.</p>
                </div>
                <div className="mt-4 md:mt-0 px-4 py-2 bg-white rounded-xl border border-gray-100 flex items-center gap-2 shadow-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">June 26, 2025</span>
                </div>
              </div>

              {/* 5 Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {/* Farmers */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                      <Sprout className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-tight">Total Farmers</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">
                    {loadingOverview ? "..." : (overviewData?.metrics?.totalFarmers || 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded">
                    <ArrowUp className="w-3 h-3" /> 12.6% <span className="text-gray-400 ml-1">vs last month</span>
                  </div>
                </div>

                {/* Buyers */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-tight">Total Buyers</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">
                    {loadingOverview ? "..." : (overviewData?.metrics?.totalBuyers || 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded">
                    <ArrowUp className="w-3 h-3" /> 9.4% <span className="text-gray-400 ml-1">vs last month</span>
                  </div>
                </div>

                {/* Delivery */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-tight">Delivery Partners</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">
                    {loadingOverview ? "..." : (overviewData?.metrics?.deliveryPartners || 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded">
                    <ArrowUp className="w-3 h-3" /> 8.1% <span className="text-gray-400 ml-1">vs last month</span>
                  </div>
                </div>

                {/* Orders */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-tight">Orders Today</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">
                    {loadingOverview ? "..." : (overviewData?.metrics?.ordersToday || 0).toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded">
                    <ArrowUp className="w-3 h-3" /> 15.3% <span className="text-gray-400 ml-1">vs yesterday</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                      <IndianRupee className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider leading-tight">Revenue Today</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">
                    {loadingOverview ? "..." : `₹${(overviewData?.metrics?.revenueToday || 0).toLocaleString()}`}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 w-fit px-2 py-0.5 rounded">
                    <ArrowUp className="w-3 h-3" /> 18.7% <span className="text-gray-400 ml-1">vs yesterday</span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Graph + Verifications + Complaints */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                
                {/* Market Growth Graph */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-800">Market Growth <span className="text-gray-400 font-medium text-sm">(Last 6 Months)</span></h3>
                    </div>
                    <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600">
                      Last 6 Months <ChevronDown className="w-3 h-3" />
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-6 mb-6">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#2196F3]"></div><span className="text-xs font-bold text-gray-600">Orders</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#4CAF50]"></div><span className="text-xs font-bold text-gray-600">Revenue (₹)</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF9800]"></div><span className="text-xs font-bold text-gray-600">Users</span></div>
                  </div>

                  <div className="flex-1 min-h-[250px] relative">
                    {renderMarketGrowthChart()}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Total Orders</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-800">35,671</span>
                        <span className="text-[10px] font-bold text-green-600 flex items-center"><ArrowUp className="w-3 h-3"/> 15.3%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Total Revenue</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-800">₹2,48,75,300</span>
                        <span className="text-[10px] font-bold text-green-600 flex items-center"><ArrowUp className="w-3 h-3"/> 18.7%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">New Users</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-800">3,245</span>
                        <span className="text-[10px] font-bold text-green-600 flex items-center"><ArrowUp className="w-3 h-3"/> 11.2%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Verifications & Complaints */}
                <div className="space-y-6">
                  {/* Pending Verifications */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Pending Verifications</h3>
                    <div className="space-y-3">
                      <div className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between bg-gray-50 hover:bg-white transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <UserIcon className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-500">Farmers (Aadhaar)</p>
                            <p className="text-lg font-black text-gray-800">
                              {loadingOverview ? "..." : (overviewData?.verifications?.farmersPending || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button className="text-xs font-bold text-[#1B5E20] bg-green-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Review &rarr;</button>
                      </div>

                      <div className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between bg-gray-50 hover:bg-white transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Truck className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-500">Delivery Partners (Documents)</p>
                            <p className="text-lg font-black text-gray-800">
                              {loadingOverview ? "..." : (overviewData?.verifications?.deliveryPending || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button className="text-xs font-bold text-[#1B5E20] bg-green-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Review &rarr;</button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
                      <span className="text-sm font-semibold text-gray-500">Total Pending</span>
                      <span className="text-lg font-black text-red-500">
                        {loadingOverview ? "..." : ((overviewData?.verifications?.farmersPending || 0) + (overviewData?.verifications?.deliveryPending || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Complaints Summary */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Complaints Summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full border border-red-200 flex items-center justify-center bg-white shrink-0">
                          <Info className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-600">Open Complaints</p>
                        </div>
                        <span className="text-lg font-black text-gray-800">
                          {loadingOverview ? "..." : (overviewData?.complaints?.open || 0).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full border border-amber-200 flex items-center justify-center bg-white shrink-0">
                          <MessageSquare className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-600">High Priority</p>
                        </div>
                        <span className="text-lg font-black text-gray-800">
                          {loadingOverview ? "..." : (overviewData?.complaints?.highPriority || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full border border-green-200 flex items-center justify-center bg-white shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-600">Resolved Today</p>
                        </div>
                        <span className="text-lg font-black text-gray-800">
                          {loadingOverview ? "..." : (overviewData?.complaints?.resolvedToday || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button className="w-full mt-4 py-2 border border-[#1B5E20] text-[#1B5E20] font-bold text-sm rounded-xl hover:bg-[#1B5E20] hover:text-white transition-colors flex items-center justify-center gap-2">
                      View Complaints &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Recent Activities & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Recent Activities */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-gray-800 mb-6">Recent Activities</h3>
                  <div className="space-y-6 flex-1">
                    {loadingOverview ? (
                      <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300"></div></div>
                    ) : overviewData?.activities?.length > 0 ? (
                      overviewData.activities.map((act: any) => {
                        let Icon = UserIcon;
                        let colorClass = "text-green-600";
                        let bgClass = "bg-green-50";

                        if (act.type === "ORDER_PLACED") {
                          Icon = ShoppingBag; colorClass = "text-blue-600"; bgClass = "bg-blue-50";
                        } else if (act.type === "COMPLAINT_RAISED") {
                          Icon = AlertCircle; colorClass = "text-purple-600"; bgClass = "bg-purple-50";
                        }

                        return (
                          <div key={act.id} className="flex gap-4">
                            <div className={`w-8 h-8 rounded-full ${bgClass} flex items-center justify-center shrink-0 mt-1`}>
                              <Icon className={`w-4 h-4 ${colorClass}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-bold text-gray-800">{act.title}</p>
                                <span className="text-xs font-semibold text-gray-400">
                                  {new Date(act.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-gray-500 mt-0.5">{act.desc}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 text-center mt-10">No recent activities</p>
                    )}
                  </div>
                  <button className="w-full mt-6 py-2 border border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors">
                    View All Activities
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-6">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="p-5 rounded-2xl bg-green-50 border border-green-100 hover:border-green-300 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <FileCheck className="w-6 h-6 text-[#1B5E20]" />
                        <ArrowRight className="w-4 h-4 text-[#1B5E20] opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">Verify Documents</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">Review pending documents</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 hover:border-blue-300 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <Bell className="w-6 h-6 text-blue-600" />
                        <ArrowRight className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">Send Notification</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">Send announcements to users</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 hover:border-amber-300 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                        <ArrowRight className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">View Complaints</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">Check and resolve complaints</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100 hover:border-purple-300 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <CreditCard className="w-6 h-6 text-purple-600" />
                        <ArrowRight className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </div>
                      <h4 className="text-sm font-bold text-gray-800">Transactions</h4>
                      <p className="text-xs font-medium text-gray-500 mt-1">View payments and settlements</p>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === "applications" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#FAFBFA]">
                  <h3 className="font-bold text-lg text-gray-800">Pending Approvals</h3>
                  {!loadingApps && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">{applications.length} Pending</span>
                  )}
                </div>
                
                {loadingApps ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20] mx-auto mb-4"></div>
                    <p className="text-sm font-semibold text-gray-500">Fetching applications...</p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-gray-800">All caught up!</h3>
                    <p className="text-sm font-semibold text-gray-500 mt-1">No pending applications to review.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {applications.map(app => (
                      <div key={app.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${app.role === "FARMER" ? "bg-green-100" : "bg-orange-100"}`}>
                            {app.role === "FARMER" ? <Tractor className="w-6 h-6 text-green-600" /> : <Truck className="w-6 h-6 text-orange-600" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800">{app.user?.name || "Unknown User"}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${app.role === "FARMER" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                                {app.role}
                              </span>
                              <span className="text-xs font-semibold text-gray-400">• {new Date(app.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-500 mt-2">
                              {app.role === "FARMER" 
                                ? `Farm Area: ${app.user?.farmArea || 'N/A'} Acres, Village: ${app.user?.village || 'N/A'}` 
                                : `Vehicle: ${app.user?.vehicleType || 'N/A'}, Aadhaar: ${app.user?.aadhaarLast4 || 'N/A'}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <button 
                            onClick={() => processApplication(app.id, 'REJECT')}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-2"
                          >
                            <X size={16} /> Reject
                          </button>
                          <button 
                            onClick={() => processApplication(app.id, 'APPROVE')}
                            className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-[#1B5E20] hover:bg-[#2E7D32] transition-colors shadow-sm flex items-center gap-2"
                          >
                            <Check size={16} /> Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#FAFBFA]">
                  <h3 className="font-bold text-lg text-gray-800">User Directory</h3>
                  <button className="text-sm font-bold text-[#1B5E20] hover:text-[#2E7D32]">Export CSV</button>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-4 pl-6">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Joined</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {MOCK_USERS.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 pl-6 font-bold text-gray-800">{u.name}</td>
                        <td className="p-4">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">{u.role}</span>
                        </td>
                        <td className="p-4 text-sm font-semibold text-gray-500">{u.joined}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button className="text-sm font-bold text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 justify-end w-full">
                            <Ban size={14} /> Block
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COMPLAINTS TAB */}
          {activeTab === "complaints" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-[#FAFBFA]">
                  <h3 className="font-bold text-lg text-gray-800">Active Disputes</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {MOCK_COMPLAINTS.map(c => (
                    <div key={c.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase">{c.status}</span>
                          <span className="text-sm font-bold text-gray-800">Complaint #{c.id}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-500">
                          <span className="text-gray-800">{c.from}</span> reported <span className="text-gray-800">{c.against}</span>
                        </p>
                        <p className="text-sm font-medium text-gray-600 mt-2 bg-gray-50 p-3 rounded-xl border border-gray-100">"{c.reason}"</p>
                      </div>
                      <button className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                        Review Case
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-800"><MessageSquare className="text-[#1B5E20]"/> Broadcast Notification</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">Target Audience</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]">
                      <option>All Users</option>
                      <option>Only Farmers</option>
                      <option>Only Delivery Partners</option>
                      <option>Specific User (by ID)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">Message Content</label>
                    <textarea 
                      rows={4}
                      placeholder="Type your notification here..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] resize-none"
                    ></textarea>
                  </div>
                  <button className="w-full py-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                    Send Broadcast Notification
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// Subcomponents
const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
      active ? "bg-[#E8F5E9] text-[#1B5E20] font-bold" : "text-gray-500 hover:bg-gray-50 hover:text-[#1B5E20] font-bold"
    }`}
  >
    <div className="flex items-center gap-3">
      <Icon className={`w-5 h-5 ${active ? "text-[#1B5E20]" : "text-gray-400"}`} />
      <span className="text-sm">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
        active ? "bg-red-100 text-red-600" : "bg-gray-200 text-gray-500"
      }`}>
        {badge}
      </span>
    )}
  </button>
);

const MetricCard = ({ title, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} shrink-0`}>
      <Icon className={`w-7 h-7 ${color}`} />
    </div>
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">{title}</p>
      <h3 className="text-2xl font-black text-gray-800">{value}</h3>
    </div>
  </div>
);
