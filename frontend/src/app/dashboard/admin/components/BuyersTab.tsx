"use client";
import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/axios';
import { 
  Users, ShieldCheck, Clock, ShoppingBag, Ban, 
  Search, ChevronDown, Calendar, Filter,
  MoreVertical, Eye, Mail, MapPin, ChevronLeft, ChevronRight, Check, X, AlertTriangle
} from 'lucide-react';

const PAGE_SIZE = 10;

export default function BuyersTab() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [cityFilter, setCityFilter] = useState("All Cities");
  const [dateFilter, setDateFilter] = useState("All Time");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Row Expansion
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Action modals
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [notifModal, setNotifModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBuyers();
  }, []);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/buyers');
      if (res.data.success) {
        setBuyers(res.data.buyers || []);
        setMetrics(res.data.metrics || null);
      }
    } catch (error) {
      console.error("Failed to fetch buyers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique cities for dropdown
  const uniqueCities = useMemo(() => {
    const cities = buyers
      .map(b => b.location)
      .filter((c): c is string => !!c && c !== "Unknown");
    return ["All Cities", ...Array.from(new Set(cities))];
  }, [buyers]);

  const now = new Date();
  const filteredBuyers = useMemo(() => {
    return buyers.filter(buyer => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        (buyer.name && buyer.name.toLowerCase().includes(q)) || 
        (buyer.email && buyer.email.toLowerCase().includes(q)) ||
        (buyer.phone && buyer.phone.includes(q));
      
      // Status
      const matchesStatus = statusFilter === "All Status" || buyer.status === statusFilter;

      // City
      const matchesCity = cityFilter === "All Cities" || buyer.location === cityFilter;

      // Joined date
      let matchesDate = true;
      if (dateFilter !== "All Time") {
        const joinDate = new Date(buyer.joinedOn);
        if (dateFilter === "This Month") {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          matchesDate = joinDate >= firstDay;
        } else if (dateFilter === "Last Month") {
          const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const firstOfThis = new Date(now.getFullYear(), now.getMonth(), 1);
          matchesDate = joinDate >= firstOfLast && joinDate < firstOfThis;
        } else if (dateFilter === "Last 3 Months") {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          matchesDate = joinDate >= threeMonthsAgo;
        } else if (dateFilter === "This Year") {
          matchesDate = joinDate.getFullYear() === now.getFullYear();
        }
      }
      
      return matchesSearch && matchesStatus && matchesCity && matchesDate;
    });
  }, [buyers, searchQuery, statusFilter, cityFilter, dateFilter]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredBuyers.length / PAGE_SIZE));
  const pagedBuyers = filteredBuyers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, cityFilter, dateFilter]);

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColors = (index: number) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-purple-100 text-purple-600",
      "bg-orange-100 text-orange-600",
      "bg-teal-100 text-teal-600",
      "bg-red-100 text-red-600",
    ];
    return colors[index % colors.length];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleBlock = async () => {
    if (!selectedBuyer) return;
    setActionLoading(true);
    try {
      const isCurrentlyActive = selectedBuyer.status !== "Suspended";
      await api.patch(`/admin/buyers/${selectedBuyer.id}/block`, { block: isCurrentlyActive });
      await fetchBuyers();
      setBlockModal(false);
      setSelectedBuyer(null);
    } catch (e) {
      console.error("Block error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedBuyer || !notifMessage.trim()) return;
    setActionLoading(true);
    try {
      // For now, log - notification endpoint can be wired later
      console.log("Sending notification to:", selectedBuyer.id, notifMessage);
      setNotifModal(false);
      setNotifMessage("");
      setSelectedBuyer(null);
    } catch (e) {
      console.error("Notification error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Buyers</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">View, manage and monitor all buyer accounts.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
          More Actions
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Buyers</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{metrics ? metrics.totalBuyers.toLocaleString() : "..."}</h3>
            <p className="text-xs font-semibold text-green-600 mt-1 flex items-center gap-1">↑ 9.4% <span className="text-gray-400 font-medium">vs last month</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Verified Buyers</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{metrics ? metrics.verifiedBuyers.toLocaleString() : "..."}</h3>
            <p className="text-xs font-semibold text-green-600 mt-1">
              {metrics && metrics.totalBuyers > 0 ? ((metrics.verifiedBuyers / metrics.totalBuyers) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">New This Month</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{metrics ? metrics.newThisMonth.toLocaleString() : "..."}</h3>
            <p className="text-xs font-semibold text-green-600 mt-1">↑ 11.3% <span className="text-gray-400 font-medium">vs last month</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Buyers</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{metrics ? metrics.activeBuyers.toLocaleString() : "..."}</h3>
            <p className="text-xs font-semibold text-green-600 mt-1">
              {metrics && metrics.totalBuyers > 0 ? ((metrics.activeBuyers / metrics.totalBuyers) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Suspended Buyers</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{metrics ? metrics.suspendedBuyers.toLocaleString() : "..."}</h3>
            <p className="text-xs font-semibold text-red-500 mt-1">
              {metrics && metrics.totalBuyers > 0 ? ((metrics.suspendedBuyers / metrics.totalBuyers) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by name, email or phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* City Filter — dynamically populated */}
            <div className="relative hidden md:block">
              <select 
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer max-w-[160px]"
              >
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Joined Date Filter */}
            <div className="relative hidden md:block">
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer"
              >
                <option value="All Time">Joined Date</option>
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
                <option value="Last 3 Months">Last 3 Months</option>
                <option value="This Year">This Year</option>
              </select>
              <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Active filter indicators */}
            {(cityFilter !== "All Cities" || dateFilter !== "All Time" || statusFilter !== "All Status") && (
              <button 
                onClick={() => { setCityFilter("All Cities"); setDateFilter("All Time"); setStatusFilter("All Status"); setSearchQuery(""); }}
                className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
              >
                <X className="w-3 h-3" /> Clear Filters
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Buyer</th>
                <th className="py-4 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Location</th>
                <th className="py-4 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Joined On</th>
                <th className="py-4 px-6 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm font-semibold text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20] mx-auto mb-4"></div>
                    Loading buyers...
                  </td>
                </tr>
              ) : pagedBuyers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm font-semibold text-gray-500">
                    No buyers found matching your filters.
                  </td>
                </tr>
              ) : (
                pagedBuyers.map((buyer, index) => (
                  <React.Fragment key={buyer.id}>
                  <tr 
                    onClick={() => toggleRow(buyer.id)}
                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarColors((currentPage - 1) * PAGE_SIZE + index)}`}>
                          {getInitials(buyer.name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{buyer.name || "—"}</p>
                          <p className="text-xs font-medium text-gray-400">{buyer.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{buyer.location}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      {buyer.status === "Verified" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {buyer.status === "Pending" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span> Pending
                        </span>
                      )}
                      {buyer.status === "Suspended" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                          <Ban className="w-3 h-3" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-sm font-semibold text-gray-600 whitespace-nowrap">
                      {formatDate(buyer.joinedOn)}
                    </td>
                    <td className="py-3 px-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          title="View Profile"
                          className="p-1.5 text-gray-400 hover:text-[#1B5E20] hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          title="Send Notification"
                          onClick={() => { setSelectedBuyer(buyer); setNotifMessage(""); setNotifModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button 
                          title={buyer.status === "Suspended" ? "Unblock" : "Block"}
                          onClick={() => { setSelectedBuyer(buyer); setBlockModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRows[buyer.id] ? "rotate-180" : ""} ml-2 opacity-100`} />
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedRows[buyer.id] && (
                    <tr className="bg-[#FAFBFA] border-b border-gray-100">
                      <td colSpan={5} className="p-0">
                        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                            <p className="text-sm font-semibold text-gray-700">{buyer.phone || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Total Orders</p>
                            <p className="text-sm font-black text-gray-900">{buyer.totalOrders ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Total Spent</p>
                            <p className="text-sm font-black text-gray-900">₹{(buyer.totalSpent ?? 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm">
          <p className="text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-900">{filteredBuyers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * PAGE_SIZE, filteredBuyers.length)}</span> of <span className="font-bold text-gray-900">{filteredBuyers.length}</span> buyers
          </p>
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + i;
                if (pageNum > totalPages) return null;
              }
              return (
                <button 
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${currentPage === pageNum ? 'bg-[#1B5E20] text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>}
            {totalPages > 5 && (
              <button 
                onClick={() => setCurrentPage(totalPages)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${currentPage === totalPages ? 'bg-[#1B5E20] text-white' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                {totalPages}
              </button>
            )}
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Send Notification Modal */}
      {notifModal && selectedBuyer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-gray-900">Send Notification</h2>
              <button onClick={() => { setNotifModal(false); setSelectedBuyer(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Sending to: <span className="font-bold text-gray-800">{selectedBuyer.name}</span></p>
            <textarea 
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Type your notification message..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-[#1B5E20] resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setNotifModal(false); setSelectedBuyer(null); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleSendNotification} 
                disabled={!notifMessage.trim() || actionLoading}
                className="flex-1 py-2.5 bg-[#1B5E20] text-white rounded-xl text-sm font-bold hover:bg-[#2E7D32] disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block/Unblock Confirmation Modal */}
      {blockModal && selectedBuyer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-gray-900">
                {selectedBuyer.status === "Suspended" ? "Unblock Buyer" : "Block Buyer"}
              </h2>
              <button onClick={() => { setBlockModal(false); setSelectedBuyer(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-orange-700">
                {selectedBuyer.status === "Suspended"
                  ? `Are you sure you want to unblock "${selectedBuyer.name}"? They will regain access to the platform.`
                  : `Are you sure you want to block "${selectedBuyer.name}"? They will lose access to the platform.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setBlockModal(false); setSelectedBuyer(null); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleBlock}
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${selectedBuyer.status === "Suspended" ? "bg-[#1B5E20] hover:bg-[#2E7D32]" : "bg-red-600 hover:bg-red-700"}`}
              >
                {actionLoading ? "Processing..." : selectedBuyer.status === "Suspended" ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
