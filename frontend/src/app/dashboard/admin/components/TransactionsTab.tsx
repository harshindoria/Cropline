"use client";
import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { 
  Search, Filter, CreditCard, Coins, Send, XCircle, 
  ChevronRight, Eye, X, CheckCircle2, AlertTriangle, 
  Clock, Download, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type TabType = 'ONLINE' | 'CASH' | 'SETTLEMENTS';

interface OverviewStats {
  onlinePayments: number;
  cashPendingDeposit: number;
  cashPendingOrdersCount: number;
  pendingSettlements: number;
  pendingSettlementsCount: number;
  failedTransactions: number;
}

interface OrderInfo {
  id: string;
  totalBuyerPrice: string;
  farmerEarnings: string;
  deliveryPartnerPayout: string;
  platformFee: string;
  deliveryPlatformFee: string;
  discountAmount: string;
  completedAt: string | null;
  buyer?: { name: string; phone: string };
  farmer?: { name: string; phone: string };
  deliveryJob?: {
    deliveryPartner: { name: string; phone: string };
    deliveredAt: string | null;
  };
  paymentRecord?: {
    status: string;
    capturedAt: string | null;
    provider: string;
  };
}

interface OnlinePayment {
  id: string;
  provider: string;
  status: string;
  amount: string;
  createdAt: string;
  capturedAt: string | null;
  order: OrderInfo;
}

interface CashCollection {
  id: string;
  amount: string;
  status: string;
  createdAt: string;
  depositedAt: string | null;
  reconciledAt: string | null;
  deliveryPartner: { name: string; phone: string };
  order: OrderInfo;
}

interface Settlement {
  id: string;
  type: string;
  amount: string;
  status: string;
  createdAt: string;
  availableAt: string | null;
  settledAt: string | null;
  user: { name: string; phone: string };
  order: OrderInfo;
}

export default function TransactionsTab() {
  const [activeTab, setActiveTab] = useState<TabType>('ONLINE');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats>({
    onlinePayments: 0,
    cashPendingDeposit: 0,
    cashPendingOrdersCount: 0,
    pendingSettlements: 0,
    pendingSettlementsCount: 0,
    failedTransactions: 0
  });

  const [onlineData, setOnlineData] = useState<OnlinePayment[]>([]);
  const [cashData, setCashData] = useState<CashCollection[]>([]);
  const [settlementData, setSettlementData] = useState<Settlement[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [dateFilter, setDateFilter] = useState('All Time');

  const [selectedTx, setSelectedTx] = useState<{ type: TabType, data: any } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // --- Filtering Logic ---
  const filterByDate = (dateString: string) => {
    if (dateFilter === 'All Time' || !dateString) return true;
    const date = new Date(dateString);
    const now = new Date();
    if (dateFilter === 'Last 7 Days') {
      return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 7;
    }
    if (dateFilter === 'Last 30 Days') {
      return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 30;
    }
    if (dateFilter === 'This Month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filterByStatus = (status: string) => {
    if (statusFilter === 'All Status') return true;
    const s = status.toUpperCase();
    if (statusFilter === 'Success' && ['SUCCESS', 'VERIFIED', 'SETTLED', 'AVAILABLE', 'DEPOSITED'].includes(s)) return true;
    if (statusFilter === 'Pending' && ['PENDING', 'PENDING_DEPOSIT'].includes(s)) return true;
    if (statusFilter === 'Failed' && ['FAILED', 'OVERDUE'].includes(s)) return true;
    return false;
  };

  const matchesSearch = (item: any, type: string) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    let s = '';
    if (type === 'ONLINE') {
      s = `${item.id} ${item.order?.id} ${item.order?.buyer?.name} ${item.order?.buyer?.phone} ${item.provider}`;
    } else if (type === 'CASH') {
      s = `${item.id} ${item.order?.id} ${item.deliveryPartner?.name} ${item.deliveryPartner?.phone}`;
    } else if (type === 'SETTLEMENTS') {
      s = `${item.id} ${item.order?.id} ${item.user?.name} ${item.user?.phone} ${item.type}`;
    }
    return s.toLowerCase().includes(q);
  };

  const filteredOnlineData = onlineData.filter(t => filterByDate(t.createdAt) && filterByStatus(t.status) && matchesSearch(t, 'ONLINE'));
  const filteredCashData = cashData.filter(t => filterByDate(t.createdAt) && filterByStatus(t.status) && matchesSearch(t, 'CASH'));
  const filteredSettlementData = settlementData.filter(t => filterByDate(t.createdAt) && filterByStatus(t.status) && matchesSearch(t, 'SETTLEMENTS'));

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/admin/transactions/overview');
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }

      if (activeTab === 'ONLINE') {
        const res = await api.get('/admin/transactions/online');
        if (res.data.success) setOnlineData(res.data.data);
      } else if (activeTab === 'CASH') {
        const res = await api.get('/admin/transactions/cash');
        if (res.data.success) setCashData(res.data.data);
      } else if (activeTab === 'SETTLEMENTS') {
        const res = await api.get('/admin/transactions/settlements');
        if (res.data.success) setSettlementData(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDeposit = async (id: string) => {
    setProcessing(true);
    try {
      const res = await api.post(`/admin/transactions/cash/${id}/verify`);
      if (res.data.success) {
        setIsDrawerOpen(false);
        setSelectedTx(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to verify deposit:", error);
    } finally {
      setProcessing(false);
    }
  };

  const openDrawer = (type: TabType, data: any) => {
    setSelectedTx({ type, data });
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedTx(null), 300);
  };

  const formatMoney = (amount: string | number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'VERIFIED':
      case 'SETTLED':
      case 'AVAILABLE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'PENDING':
      case 'PENDING_DEPOSIT':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'FAILED':
      case 'OVERDUE':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'DEPOSITED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'VERIFIED':
      case 'SETTLED':
      case 'AVAILABLE':
        return 'bg-green-500';
      case 'PENDING':
      case 'PENDING_DEPOSIT':
        return 'bg-orange-500';
      case 'FAILED':
      case 'OVERDUE':
        return 'bg-red-500';
      case 'DEPOSITED':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 pb-10 relative">
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Transactions Management</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">Monitor all payments, collections and settlements on the platform.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by order ID, transaction ID, user..." 
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
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 text-[#1B5E20]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Online Payments</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{formatMoney(stats.onlinePayments)}</p>
            <p className="text-[10px] font-bold text-green-600 mt-1">Lifetime</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Cash Pending Deposit</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{formatMoney(stats.cashPendingDeposit)}</p>
            <p className="text-[10px] font-bold text-orange-500 mt-1">{stats.cashPendingOrdersCount} Orders</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Send className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Pending Settlements</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{formatMoney(stats.pendingSettlements)}</p>
            <p className="text-[10px] font-bold text-blue-500 mt-1">{stats.pendingSettlementsCount} Settlements</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-0.5">Failed Transactions</p>
            <p className="text-2xl font-black text-gray-900 leading-none">{stats.failedTransactions}</p>
            <p className="text-[10px] font-bold text-red-500 mt-1">Requires attention</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('ONLINE')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'ONLINE' ? 'border-[#1B5E20] text-[#1B5E20]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <CreditCard className="w-4 h-4" /> Online Payments
        </button>
        <button 
          onClick={() => setActiveTab('CASH')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'CASH' ? 'border-[#1B5E20] text-[#1B5E20]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <Coins className="w-4 h-4" /> Cash Collections
        </button>
        <button 
          onClick={() => setActiveTab('SETTLEMENTS')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'SETTLEMENTS' ? 'border-[#1B5E20] text-[#1B5E20]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <Send className="w-4 h-4" /> Settlements
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[500px]">
        
        {/* Table Filters */}
        <div className="p-4 border-b border-gray-100 shrink-0 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:border-[#1B5E20] appearance-none min-w-[150px]"
                >
                  <option>All Status</option>
                  <option>Success</option>
                  <option>Pending</option>
                  <option>Failed</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date Range</label>
              <div className="relative">
                <select 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:border-[#1B5E20] appearance-none min-w-[180px]"
                >
                  <option>All Time</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>This Month</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-gray-500">Loading data...</div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  {activeTab === 'ONLINE' && (
                    <>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Txn ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Buyer</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount Paid</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Method</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
                    </>
                  )}
                  {activeTab === 'CASH' && (
                    <>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Delivery Partner</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Cash Collected</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Deposit Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
                    </>
                  )}
                  {activeTab === 'SETTLEMENTS' && (
                    <>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Settle ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Recipient</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeTab === 'ONLINE' && filteredOnlineData.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">TXN-{t.id.substring(t.id.length - 5).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-600">ORD-{t.order.id.substring(t.order.id.length - 5).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{t.order.buyer?.name}</span>
                        <span className="text-xs text-gray-500">{t.order.buyer?.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-gray-900">{formatMoney(t.amount)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">{t.provider}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(t.status)}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(t.status)}`} />
                        {t.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-600">
                        {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">
                        {new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => openDrawer('ONLINE', t)} className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-[#1B5E20] hover:text-white transition-colors border border-gray-200 hover:border-[#1B5E20]">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'CASH' && filteredCashData.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">ORD-{t.order.id.substring(t.order.id.length - 5).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{t.deliveryPartner.name}</span>
                        <span className="text-xs text-gray-500">{t.deliveryPartner.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-[#1B5E20]">{formatMoney(t.amount)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(t.status)}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(t.status)}`} />
                        {t.status.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-600">
                        {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">
                        {new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => openDrawer('CASH', t)} className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-[#1B5E20] hover:text-white transition-colors border border-gray-200 hover:border-[#1B5E20]">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {activeTab === 'SETTLEMENTS' && filteredSettlementData.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">STL-{t.id.substring(t.id.length - 5).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-600">ORD-{t.order.id.substring(t.order.id.length - 5).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{t.user.name}</span>
                        <span className="text-xs text-gray-500">{t.user.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${t.type.includes('FARMER') ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                        {t.type.split('_')[0]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-gray-900">{formatMoney(t.amount)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(t.status)}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(t.status)}`} />
                        {t.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-600">
                        {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">
                        {new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => openDrawer('SETTLEMENTS', t)} className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-[#1B5E20] hover:text-white transition-colors border border-gray-200 hover:border-[#1B5E20]">
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
        {isDrawerOpen && selectedTx && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50 shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-black text-gray-900">
                      {selectedTx.type === 'ONLINE' && `TXN-${selectedTx.data.id.substring(selectedTx.data.id.length - 5).toUpperCase()}`}
                      {selectedTx.type === 'CASH' && `ORD-${selectedTx.data.order.id.substring(selectedTx.data.order.id.length - 5).toUpperCase()}`}
                      {selectedTx.type === 'SETTLEMENTS' && `STL-${selectedTx.data.id.substring(selectedTx.data.id.length - 5).toUpperCase()}`}
                    </h2>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(selectedTx.data.status)}`}>
                      {selectedTx.data.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-500">
                    Order ID: ORD-{selectedTx.type === 'CASH' ? selectedTx.data.order.id.substring(selectedTx.data.order.id.length - 5).toUpperCase() : selectedTx.data.order.id.substring(selectedTx.data.order.id.length - 5).toUpperCase()} 
                    • Created: {new Date(selectedTx.data.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Participants */}
                <section>
                  <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Participants</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">B</div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Buyer</p>
                          <p className="text-sm font-bold text-gray-900">{selectedTx.data.order.buyer?.name}</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">{selectedTx.data.order.buyer?.phone}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-[10px] font-bold text-green-600">F</div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Farmer</p>
                          <p className="text-sm font-bold text-gray-900">{selectedTx.data.order.farmer?.name}</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-500">{selectedTx.data.order.farmer?.phone}</p>
                    </div>
                    {selectedTx.data.order.deliveryJob && (
                      <div className="p-3 rounded-xl border border-gray-100 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">D</div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Delivery Partner</p>
                            <p className="text-sm font-bold text-gray-900">{selectedTx.type === 'CASH' ? selectedTx.data.deliveryPartner.name : selectedTx.data.order.deliveryJob.deliveryPartner.name}</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-gray-500">{selectedTx.type === 'CASH' ? selectedTx.data.deliveryPartner.phone : selectedTx.data.order.deliveryJob.deliveryPartner.phone}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Money Breakdown */}
                <section>
                  <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Money Breakdown</h3>
                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-3">
                    <div className="flex justify-between items-center text-sm font-semibold text-gray-600">
                      <p>Amount Paid by Buyer</p>
                      <p className="text-gray-900 font-bold">{formatMoney(selectedTx.data.order.totalBuyerPrice)}</p>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold text-gray-600">
                      <p>Farmer Earnings</p>
                      <p className="text-green-600 font-bold">{formatMoney(selectedTx.data.order.farmerEarnings)}</p>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold text-gray-600">
                      <p>Delivery Partner Earnings</p>
                      <p className="text-blue-600 font-bold">{formatMoney(selectedTx.data.order.deliveryPartnerPayout)}</p>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold text-gray-600">
                      <p>Platform Fee (Crop + Delivery)</p>
                      <p className="text-red-600 font-bold">{formatMoney(Number(selectedTx.data.order.platformFee) + Number(selectedTx.data.order.deliveryPlatformFee))}</p>
                    </div>
                    {Number(selectedTx.data.order.discountAmount) > 0 && (
                      <div className="flex justify-between items-center text-sm font-semibold text-gray-600">
                        <p>Discount Applied</p>
                        <p className="text-purple-600 font-bold">-{formatMoney(selectedTx.data.order.discountAmount)}</p>
                      </div>
                    )}
                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                      <p className="text-sm font-black text-gray-900">Total Calculation Base</p>
                      <p className="text-sm font-black text-gray-900">{formatMoney(Number(selectedTx.data.order.totalBuyerPrice) + Number(selectedTx.data.order.discountAmount))}</p>
                    </div>
                  </div>
                </section>

                {/* Timeline */}
                <section>
                  <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Payment Timeline</h3>
                  <div className="p-5 rounded-xl border border-gray-100 bg-white relative">
                    <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100"></div>
                    
                    <div className="space-y-6">
                      {/* Timeline logic varies based on online vs COD vs settlement */}
                      {selectedTx.type === 'ONLINE' && (
                        <>
                          <div className="flex gap-4 relative z-10">
                            <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                            <div>
                              <p className="text-sm font-bold text-gray-900">Payment Initiated</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          {selectedTx.data.capturedAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Payment Successful</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.capturedAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                          {selectedTx.data.order.completedAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Order Completed</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.order.completedAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                          {/* Note: In a real system, you'd fetch ledger entry times here for exact Farmer Settled time */}
                          {selectedTx.data.order.completedAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-gray-300 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-500">Earnings Distributed</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">After completion</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {selectedTx.type === 'CASH' && (
                        <>
                          {selectedTx.data.order.deliveryJob?.deliveredAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Order Delivered (Cash Collected)</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.order.deliveryJob.deliveredAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                          {selectedTx.data.depositedAt ? (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Partner Deposited Cash</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.depositedAt).toLocaleString()}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-orange-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-orange-600">Awaiting Cash Deposit</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">From Partner</p>
                              </div>
                            </div>
                          )}
                          {selectedTx.data.reconciledAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Admin Verified</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.reconciledAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {selectedTx.type === 'SETTLEMENTS' && (
                        <>
                          <div className="flex gap-4 relative z-10">
                            <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                            <div>
                              <p className="text-sm font-bold text-gray-900">Payout Calculated</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          {selectedTx.data.availableAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Funds Available</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.availableAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                          {selectedTx.data.settledAt && (
                            <div className="flex gap-4 relative z-10">
                              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-white" />
                              <div>
                                <p className="text-sm font-bold text-gray-900">Bank Transfer Successful</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(selectedTx.data.settledAt).toLocaleString()}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* Admin Actions (Verify Cash) */}
                {selectedTx.type === 'CASH' && selectedTx.data.status === 'DEPOSITED' && (
                  <section className="bg-gray-50 -mx-6 px-6 py-6 border-t border-gray-100">
                    <h3 className="text-sm font-black text-gray-900 mb-2 uppercase tracking-wider">Admin Verification</h3>
                    <p className="text-xs font-semibold text-gray-500 mb-4">
                      The delivery partner claims to have deposited the cash to the platform's bank account. Please check the bank statement before verifying. Verifying this will instantly unlock the Farmer's settlement.
                    </p>
                    <button 
                      onClick={() => handleVerifyDeposit(selectedTx.data.id)}
                      disabled={processing}
                      className="w-full bg-[#1B5E20] hover:bg-[#144716] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-green-900/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify Deposit & Settle Farmer
                    </button>
                  </section>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
