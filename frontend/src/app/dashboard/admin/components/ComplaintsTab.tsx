"use client";
import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { 
  Search, Filter, ChevronLeft, ChevronRight, MessageSquareWarning, 
  Clock, CheckCircle2, UserX, Eye, X, Send, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type ComplaintStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DISMISSED';

interface UserShort {
  id: string;
  name: string;
  phone: string;
  strikeCount?: number;
}

interface OrderInfo {
  id: string;
  createdAt: string;
  farmerAcceptedAt: string | null;
  dispatchStartedAt: string | null;
  completedAt: string | null;
  farmer: UserShort;
  buyer: UserShort;
  deliveryJob: {
    pickedUpAt: string | null;
    deliveredAt: string | null;
    deliveryPartner: UserShort;
  } | null;
}

interface Complaint {
  id: string;
  orderId: string;
  complainerId: string;
  accusedId: string;
  accusedRole: string;
  reason: string;
  description: string;
  evidence: string[];
  status: ComplaintStatus;
  adminRemark: string | null;
  createdAt: string;
  complainer: UserShort;
  accused: UserShort;
  order: OrderInfo | null;
}

export default function ComplaintsTab() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState({
    openComplaints: 0,
    underReview: 0,
    resolved: 0,
    blockedUsers: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [reasonFilter, setReasonFilter] = useState("All Reasons");
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [adminRemark, setAdminRemark] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [statusFilter, roleFilter, reasonFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [complaintsRes, statsRes] = await Promise.all([
        api.get('/admin/complaints', {
          params: {
            status: statusFilter,
            role: roleFilter,
            reason: reasonFilter
          }
        }),
        api.get('/admin/complaints/stats')
      ]);

      if (complaintsRes.data.success) {
        setComplaints(complaintsRes.data.data);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch complaints data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessComplaint = async (action: 'APPROVE' | 'DISMISS' | 'REQUEST_MORE_EVIDENCE') => {
    if (!selectedComplaint) return;
    setProcessing(true);
    try {
      const res = await api.patch(`/admin/complaints/${selectedComplaint.id}/process`, {
        action,
        adminRemark
      });
      if (res.data.success) {
        setIsDrawerOpen(false);
        setSelectedComplaint(null);
        setAdminRemark("");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to process complaint", error);
    } finally {
      setProcessing(false);
    }
  };

  const openDrawer = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setAdminRemark(complaint.adminRemark || "");
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedComplaint(null), 300); // Wait for animation
  };

  const getStatusColor = (status: ComplaintStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'UNDER_REVIEW': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'APPROVED': return 'bg-green-100 text-green-600 border-green-200';
      case 'DISMISSED': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Filter complaints locally for search query
  const filteredComplaints = complaints.filter(c => 
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.complainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.accused.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-6 pb-10 relative">
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Complaints Management</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">Review and take action on complaints raised by users.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by complaint ID, order ID, user..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-shadow"
            />
          </div>
          <button className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 transition-colors shrink-0">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <MessageSquareWarning className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Open Complaints</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{stats.openComplaints}</p>
            <p className="text-[10px] font-bold text-orange-500 mt-1">Require attention</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Under Review</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{stats.underReview}</p>
            <p className="text-[10px] font-bold text-blue-500 mt-1">Awaiting more info</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Resolved</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{stats.resolved}</p>
            <p className="text-[10px] font-bold text-green-500 mt-1">Action taken</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Blocked Users</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{stats.blockedUsers}</p>
            <p className="text-[10px] font-bold text-purple-500 mt-1">Accounts suspended</p>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[500px]">
        
        {/* Table Filters */}
        <div className="p-4 border-b border-gray-100 shrink-0 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:border-[#1B5E20]"
            >
              <option value="All Status">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Role</label>
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:border-[#1B5E20]"
            >
              <option value="All Roles">All Roles</option>
              <option value="FARMER">Farmer</option>
              <option value="BUYER">Buyer</option>
              <option value="DELIVERY">Delivery Partner</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Reason</label>
            <select 
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:border-[#1B5E20]"
            >
              <option value="All Reasons">All Reasons</option>
              <option value="Late Delivery">Late Delivery</option>
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Wrong Product">Wrong Product</option>
              <option value="Misbehavior">Misbehavior</option>
              <option value="Fraud">Fraud</option>
              <option value="Payment Issue">Payment Issue</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-gray-500">Loading complaints...</div>
          ) : filteredComplaints.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-gray-500">No complaints found.</div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Complaint ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Order ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Filed By</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Against</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Role</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Reason</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Created At</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.status === 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        <span className="text-sm font-bold text-gray-900">{c.id.substring(0, 10).toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-600">{c.orderId ? c.orderId.substring(0, 10).toUpperCase() : '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.complainer.name || "User"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{c.accused.name || "User"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{c.accusedRole}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-700">{c.reason}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(c.status)}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-600">
                        {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] font-bold text-gray-400">
                        {new Date(c.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => openDrawer(c)}
                        className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-[#1B5E20] hover:text-white transition-colors border border-gray-200 hover:border-[#1B5E20]"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />

            {/* Drawer */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
            >
              {selectedComplaint && (
                <>
                  {/* Drawer Header */}
                  <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50 shrink-0">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-lg font-black text-gray-900">Complaint {selectedComplaint.id.substring(0, 10).toUpperCase()}</h2>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(selectedComplaint.status)}`}>
                          {selectedComplaint.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">
                        Order ID: {selectedComplaint.orderId ? selectedComplaint.orderId.substring(0, 10).toUpperCase() : 'N/A'} • Created: {new Date(selectedComplaint.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Drawer Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* Order Participants */}
                    {selectedComplaint.order && (
                      <section>
                        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Order Participants</h3>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-green-600">FRM</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Farmer</p>
                              <p className="text-sm font-bold text-gray-900">{selectedComplaint.order.farmer.name}</p>
                              <p className="text-xs font-semibold text-gray-500">{selectedComplaint.order.farmer.phone}</p>
                            </div>
                          </div>
                          <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-blue-600">BUY</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Buyer</p>
                              <p className="text-sm font-bold text-gray-900">{selectedComplaint.order.buyer.name}</p>
                              <p className="text-xs font-semibold text-gray-500">{selectedComplaint.order.buyer.phone}</p>
                            </div>
                          </div>
                          {selectedComplaint.order.deliveryJob && (
                            <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-purple-600">DEL</span>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Delivery</p>
                                <p className="text-sm font-bold text-gray-900">{selectedComplaint.order.deliveryJob.deliveryPartner.name}</p>
                                <p className="text-xs font-semibold text-gray-500">{selectedComplaint.order.deliveryJob.deliveryPartner.phone}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Complaint Details */}
                    <section>
                      <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Complaint Details</h3>
                      <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-4">
                        <div className="grid grid-cols-2 gap-4 border-b border-gray-50 pb-4">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Filed By</p>
                            <p className="text-sm font-bold text-gray-900">{selectedComplaint.complainer.name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Against</p>
                            <p className="text-sm font-bold text-gray-900">{selectedComplaint.accused.name} <span className="text-xs text-gray-500 font-semibold">({selectedComplaint.accusedRole})</span></p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Reason</p>
                          <p className="text-sm font-bold text-[#1B5E20]">{selectedComplaint.reason}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Description</p>
                          <p className="text-sm font-semibold text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">
                            {selectedComplaint.description || "No additional description provided."}
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* Strike Info */}
                    <section>
                      <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-orange-500" /> Strike Information
                      </h3>
                      <div className="p-4 rounded-xl border border-gray-100 bg-orange-50/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Current Strikes (Against {selectedComplaint.accused.name})</p>
                            <p className="text-2xl font-black text-gray-900">{selectedComplaint.accused.strikeCount || 0} <span className="text-sm text-gray-400">/ 10</span></p>
                          </div>
                          <div className="text-right text-[10px] font-bold uppercase space-y-1">
                            <p className="text-gray-500">5 = Warning</p>
                            <p className="text-orange-600">7 = 24h Suspension</p>
                            <p className="text-red-600">10 = Block + Fine</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Order Timeline */}
                    {selectedComplaint.order && (
                      <section>
                        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Order Timeline</h3>
                        <div className="p-5 rounded-xl border border-gray-100 bg-white relative">
                          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100"></div>
                          
                          <div className="space-y-6">
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Order Created</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedComplaint.order.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                            
                            {selectedComplaint.order.farmerAcceptedAt && (
                              <div className="flex gap-4 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                                <div>
                                  <p className="text-sm font-bold text-gray-900">Farmer Accepted</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedComplaint.order.farmerAcceptedAt).toLocaleString()}</p>
                                </div>
                              </div>
                            )}

                            {selectedComplaint.order.deliveryJob?.pickedUpAt && (
                              <div className="flex gap-4 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                                <div>
                                  <p className="text-sm font-bold text-gray-900">Picked Up</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedComplaint.order.deliveryJob.pickedUpAt).toLocaleString()}</p>
                                </div>
                              </div>
                            )}

                            {selectedComplaint.order.deliveryJob?.deliveredAt && (
                              <div className="flex gap-4 relative z-10">
                                <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                                <div>
                                  <p className="text-sm font-bold text-gray-900">Delivered</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedComplaint.order.deliveryJob.deliveredAt).toLocaleString()}</p>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1 shrink-0 ring-4 ring-white flex items-center justify-center">
                                <span className="absolute w-1 h-1 bg-white rounded-full"></span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-orange-600">Complaint Raised</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedComplaint.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Admin Action Section */}
                    {selectedComplaint.status !== 'APPROVED' && selectedComplaint.status !== 'DISMISSED' && (
                      <section className="bg-gray-50 -mx-6 px-6 py-6 border-t border-gray-100">
                        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Admin Action</h3>
                        
                        <div className="mb-4">
                          <label className="block text-xs font-bold text-gray-700 mb-2">Admin Remarks</label>
                          <textarea 
                            value={adminRemark}
                            onChange={(e) => setAdminRemark(e.target.value)}
                            rows={3}
                            placeholder="Write your remarks here..."
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <button 
                            disabled={processing}
                            onClick={() => handleProcessComplaint('APPROVE')}
                            className="w-full bg-[#1B5E20] hover:bg-[#144716] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button 
                            disabled={processing}
                            onClick={() => handleProcessComplaint('DISMISS')}
                            className="w-full bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition-colors border border-red-200 flex items-center justify-center gap-2"
                          >
                            <X className="w-4 h-4" /> Dismiss
                          </button>
                        </div>
                        <button 
                          disabled={processing}
                          onClick={() => handleProcessComplaint('REQUEST_MORE_EVIDENCE')}
                          className="w-full bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition-colors border border-gray-200 shadow-sm flex items-center justify-center gap-2"
                        >
                          <MessageSquareWarning className="w-4 h-4 text-orange-500" /> Request More Evidence
                        </button>

                        <p className="text-[10px] font-bold text-gray-500 mt-4 text-center">
                          Note: Approving this complaint will immediately increase the strike count of the accused user.
                        </p>
                      </section>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
