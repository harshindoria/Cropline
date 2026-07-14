"use client";
import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/axios';
import { 
  Users, ShieldCheck, Clock, Ban, XCircle,
  Search, ChevronDown, Calendar,
  Eye, Mail, MapPin, ChevronLeft, ChevronRight, Check, X, AlertTriangle, Truck
} from 'lucide-react';

const PAGE_SIZE = 10;

export default function DeliveryTab() {
  const [partners, setPartners] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [districtFilter, setDistrictFilter] = useState("All Districts");
  const [vehicleFilter, setVehicleFilter] = useState("All Vehicles");
  const [dateFilter, setDateFilter] = useState("All Time");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Row Expansion
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Action modals
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [notifModal, setNotifModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/delivery');
      if (res.data.success) {
        setPartners(res.data.partners || []);
        setMetrics(res.data.metrics || null);
      } else {
        setError("Failed to fetch delivery partners data.");
      }
    } catch (err: any) {
      console.error("Failed to fetch delivery partners:", err);
      setError(err?.response?.data?.message || "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // Extract unique districts for dropdown (based on city field which is district)
  const uniqueDistricts = useMemo(() => {
    const districts = partners
      .map(p => p.city)
      .filter((c): c is string => !!c && c.trim() !== "" && c !== "Unknown");
    return ["All Districts", ...Array.from(new Set(districts)).sort()];
  }, [partners]);

  // Extract unique vehicle types for dropdown
  const uniqueVehicles = useMemo(() => {
    const vehicles = partners
      .map(p => p.vehicleType)
      .filter((v): v is string => !!v && v !== "N/A");
    return ["All Vehicles", ...Array.from(new Set(vehicles)).sort()];
  }, [partners]);

  const now = useMemo(() => new Date(), []);

  const filteredPartners = useMemo(() => {
    return partners.filter(partner => {
      // Search by name, email, or phone
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (partner.name && partner.name.toLowerCase().includes(q)) ||
        (partner.email && partner.email.toLowerCase().includes(q)) ||
        (partner.phone && partner.phone.includes(q));

      // Status filter
      const matchesStatus = statusFilter === "All Status" || partner.status === statusFilter;

      // District filter: match against the city field (which holds district)
      const matchesDistrict = districtFilter === "All Districts" || partner.city === districtFilter;

      // Vehicle filter
      const matchesVehicle = vehicleFilter === "All Vehicles" || partner.vehicleType === vehicleFilter;

      // Joined date filter
      let matchesDate = true;
      if (dateFilter !== "All Time" && partner.joinedOn) {
        const joinDate = new Date(partner.joinedOn);
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

      return matchesSearch && matchesStatus && matchesDistrict && matchesVehicle && matchesDate;
    });
  }, [partners, searchQuery, statusFilter, districtFilter, vehicleFilter, dateFilter, now]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / PAGE_SIZE));
  const pagedPartners = filteredPartners.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, districtFilter, vehicleFilter, dateFilter]);

  const hasActiveFilters = searchQuery || statusFilter !== "All Status" || districtFilter !== "All Districts" || vehicleFilter !== "All Vehicles" || dateFilter !== "All Time";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("All Status");
    setDistrictFilter("All Districts");
    setVehicleFilter("All Vehicles");
    setDateFilter("All Time");
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColors = (index: number) => {
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-purple-100 text-purple-700",
      "bg-orange-100 text-orange-700",
      "bg-teal-100 text-teal-700",
      "bg-green-100 text-green-700",
    ];
    return colors[index % colors.length];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatVehicleType = (type: string) => {
    if (!type || type === "N/A") return "—";
    return type.replace(/_/g, ' ');
  };

  const handleBlock = async () => {
    if (!selectedPartner) return;
    setActionLoading(true);
    try {
      const shouldBlock = selectedPartner.status !== "Suspended";
      await api.patch(`/admin/buyers/${selectedPartner.id}/block`, { block: shouldBlock });
      await fetchPartners();
      setBlockModal(false);
      setSelectedPartner(null);
    } catch (e) {
      console.error("Block error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedPartner || !notifMessage.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/notifications/send`, { userId: selectedPartner.id, message: notifMessage });
      setNotifModal(false);
      setNotifMessage("");
      setSelectedPartner(null);
    } catch (e) {
      console.error("Notification error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const totalAllPartners = partners.length;
  const verifiedCount = partners.filter(p => p.status === 'Verified').length;
  const pendingCount = partners.filter(p => p.status === 'Pending').length;
  const rejectedCount = partners.filter(p => p.status === 'Rejected').length;
  const suspendedCount = partners.filter(p => p.status === 'Suspended').length;

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Delivery Partners</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1">Manage and monitor all delivery partner accounts.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Partners */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">Total Partners</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900">
              {loading ? <span className="text-gray-300">...</span> : totalAllPartners}
            </h3>
            <p className="text-xs font-semibold text-green-600 mt-1">All accounts</p>
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">Verified</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900">
              {loading ? <span className="text-gray-300">...</span> : verifiedCount}
            </h3>
            <p className="text-xs font-semibold text-green-600 mt-1">
              {totalAllPartners > 0 ? ((verifiedCount / totalAllPartners) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">Pending</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900">
              {loading ? <span className="text-gray-300">...</span> : pendingCount}
            </h3>
            <p className="text-xs font-semibold text-orange-500 mt-1">
              {totalAllPartners > 0 ? ((pendingCount / totalAllPartners) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">Rejected</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900">
              {loading ? <span className="text-gray-300">...</span> : rejectedCount}
            </h3>
            <p className="text-xs font-semibold text-red-500 mt-1">
              {totalAllPartners > 0 ? ((rejectedCount / totalAllPartners) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>

        {/* Suspended */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5 text-gray-500" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">Suspended</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900">
              {loading ? <span className="text-gray-300">...</span> : suspendedCount}
            </h3>
            <p className="text-xs font-semibold text-gray-500 mt-1">
              {totalAllPartners > 0 ? ((suspendedCount / totalAllPartners) * 100).toFixed(1) : "0"}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchPartners} className="text-red-600 font-bold hover:underline ml-4">Retry</button>
        </div>
      )}

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">

        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] bg-white"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer"
            >
              <option value="All Status">All Status</option>
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
              <option value="Suspended">Suspended</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* District Filter */}
          <div className="relative hidden md:block">
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer max-w-[180px]"
            >
              {uniqueDistricts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Vehicle Filter */}
          <div className="relative hidden md:block">
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer max-w-[180px]"
            >
              {uniqueVehicles.map(v => (
                <option key={v} value={v}>{formatVehicleType(v)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Joined Date Filter */}
          <div className="relative hidden md:block">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer"
            >
              <option value="All Time">Joined: All Time</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="Last 3 Months">Last 3 Months</option>
              <option value="This Year">This Year</option>
            </select>
            <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
            >
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-3.5 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Partner</th>
                <th className="py-3.5 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Location</th>
                <th className="py-3.5 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-3.5 px-6 text-xs font-black text-gray-500 uppercase tracking-wider">Joined On</th>
                <th className="py-3.5 px-6 text-xs font-black text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div>
                      <p className="text-sm font-semibold text-gray-400">Loading partners...</p>
                    </div>
                  </td>
                </tr>
              ) : pagedPartners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                        <Truck className="w-7 h-7 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">
                        {hasActiveFilters ? "No partners match your filters." : "No partners found."}
                      </p>
                      {hasActiveFilters && (
                        <button onClick={clearAllFilters} className="text-xs text-[#1B5E20] font-bold hover:underline">
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedPartners.map((partner, index) => (
                  <React.Fragment key={partner.id}>
                  <tr 
                    onClick={() => toggleRow(partner.id)}
                    className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                  >
                    {/* Partner */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarColors((currentPage - 1) * PAGE_SIZE + index)}`}>
                          {getInitials(partner.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{partner.name || "—"}</p>
                          <p className="text-xs font-medium text-gray-400 truncate">{partner.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    {/* Location */}
                    <td className="py-3 px-6">
                      {partner.location && partner.location !== "Unknown" ? (
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[130px]">{partner.location}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-300 font-medium">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="py-3 px-6">
                      {partner.status === "Verified" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {partner.status === "Pending" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span> Pending
                        </span>
                      )}
                      {partner.status === "Rejected" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                      {partner.status === "Suspended" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">
                          <Ban className="w-3 h-3" /> Suspended
                        </span>
                      )}
                    </td>
                    {/* Joined On */}
                    <td className="py-3 px-6 text-sm font-semibold text-gray-600 whitespace-nowrap">
                      {formatDate(partner.joinedOn)}
                    </td>
                    {/* Actions */}
                    <td className="py-3 px-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="View Profile"
                          className="p-1.5 text-gray-400 hover:text-[#1B5E20] hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Send Notification"
                          onClick={() => { setSelectedPartner(partner); setNotifMessage(""); setNotifModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          title={partner.status === "Suspended" ? "Unblock Partner" : "Block Partner"}
                          onClick={() => { setSelectedPartner(partner); setBlockModal(true); }}
                          className={`p-1.5 rounded-lg transition-colors ${partner.status === "Suspended" ? "text-orange-500 hover:bg-orange-50" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRows[partner.id] ? "rotate-180" : ""} ml-2`} />
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedRows[partner.id] && (
                    <tr className="bg-[#FAFBFA] border-b border-gray-100">
                      <td colSpan={5} className="p-0">
                        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                            <p className="text-sm font-semibold text-gray-700">{partner.phone || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Vehicle</p>
                            <p className="text-sm font-bold text-gray-900 capitalize">{formatVehicleType(partner.vehicleType)}</p>
                            {partner.vehicleNumber !== "N/A" && (
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{partner.vehicleNumber}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Deliveries</p>
                            <p className="text-sm font-black text-gray-900">{partner.totalOrders ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Earnings</p>
                            <p className="text-sm font-black text-gray-900">₹{(partner.earnings ?? 0).toLocaleString()}</p>
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
            Showing{' '}
            <span className="font-bold text-gray-900">
              {filteredPartners.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
            </span>
            {' '}to{' '}
            <span className="font-bold text-gray-900">
              {Math.min(currentPage * PAGE_SIZE, filteredPartners.length)}
            </span>
            {' '}of{' '}
            <span className="font-bold text-gray-900">{filteredPartners.length}</span>
            {' '}partners
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                    currentPage === pageNum
                      ? 'bg-[#1B5E20] text-white'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
            )}
            {totalPages > 5 && currentPage < totalPages - 1 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                  currentPage === totalPages ? 'bg-[#1B5E20] text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {totalPages}
              </button>
            )}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Send Notification Modal */}
      {notifModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-gray-900">Send Notification</h2>
              <button
                onClick={() => { setNotifModal(false); setSelectedPartner(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Sending to: <span className="font-bold text-gray-800">{selectedPartner.name}</span>
            </p>
            <textarea
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
              placeholder="Type your notification message..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setNotifModal(false); setSelectedPartner(null); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
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
      {blockModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-gray-900">
                {selectedPartner.status === "Suspended" ? "Unblock Partner" : "Block Partner"}
              </h2>
              <button
                onClick={() => { setBlockModal(false); setSelectedPartner(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-orange-700">
                {selectedPartner.status === "Suspended"
                  ? `Are you sure you want to unblock "${selectedPartner.name}"? They will regain access.`
                  : `Are you sure you want to block "${selectedPartner.name}"? They will lose platform access.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setBlockModal(false); setSelectedPartner(null); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  selectedPartner.status === "Suspended"
                    ? "bg-[#1B5E20] hover:bg-[#2E7D32]"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading
                  ? "Processing..."
                  : selectedPartner.status === "Suspended"
                  ? "Unblock"
                  : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
