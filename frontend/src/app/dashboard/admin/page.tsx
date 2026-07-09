"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  Search, Bell, ChevronDown, ShieldCheck, LayoutDashboard, 
  Users, FileText, AlertTriangle, MessageSquare, Check, X,
  TrendingUp, Activity, Leaf, User as UserIcon, CheckCircle2,
  Ban, Tractor, Truck
} from "lucide-react";

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
  
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  
  // Applications State
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "ADMIN")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

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

  useEffect(() => {
    if (activeTab === "applications" && user?.activeRole === "ADMIN") {
      fetchApplications();
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

  return (
    <div className="min-h-screen bg-[#FAFBFA] flex font-[family-name:var(--font-poppins)] text-[#212121]">
      
      {/* ── Sidebar (Light Green Premium Theme) ── */}
      <aside className="w-64 bg-[#F2F7F2] border-r border-green-100 flex flex-col hidden lg:flex shrink-0">
        <div className="p-6 pb-2 border-b border-green-100">
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
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <SidebarItem icon={FileText} label="Applications" active={activeTab === "applications"} onClick={() => setActiveTab("applications")} badge={activeTab === "applications" ? applications.length : undefined} />
          <SidebarItem icon={Users} label="User Management" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
          <SidebarItem icon={AlertTriangle} label="Complaints" active={activeTab === "complaints"} onClick={() => setActiveTab("complaints")} badge={1} />
          <SidebarItem icon={MessageSquare} label="Notifications" active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} />
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
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <MetricCard title="Total Revenue" value={MOCK_METRICS.totalRevenue} icon={TrendingUp} color="text-green-600" bg="bg-green-100" />
                <MetricCard title="Active Users" value={MOCK_METRICS.activeUsers} icon={Users} color="text-blue-600" bg="bg-blue-100" />
                <MetricCard title="Pending Apps" value={MOCK_METRICS.pendingApps} icon={FileText} color="text-amber-600" bg="bg-amber-100" />
                <MetricCard title="Open Disputes" value={MOCK_METRICS.disputes} icon={AlertTriangle} color="text-red-600" bg="bg-red-100" />
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-400">Transaction Charts will appear here</h3>
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
      active ? "bg-white text-[#1B5E20] shadow-sm font-bold" : "text-gray-500 hover:bg-white/50 hover:text-[#1B5E20] font-bold"
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
