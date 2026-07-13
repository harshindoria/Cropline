"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { 
  ArrowLeft, BarChart2, TrendingUp, TrendingDown, Package, ShoppingBag, 
  IndianRupee, Leaf, Calendar, ChevronDown, Check, User
} from "lucide-react";

export default function BuyerAnalytics() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // General state
  const [stats, setStats] = useState<any>({
    totalSpent: 0,
    totalVolume: 0,
    activeOrders: 0,
    totalSavings: 0
  });
  const [spendTrends, setSpendTrends] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [topFarmers, setTopFarmers] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Crop price trends state
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [cropTrendData, setCropTrendData] = useState<any[]>([]);
  const [loadingCropTrends, setLoadingCropTrends] = useState(false);
  const [showCropDropdown, setShowCropDropdown] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.activeRole !== "BUYER")) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Fetch general stats
  useEffect(() => {
    const fetchGeneralAnalytics = async () => {
      try {
        setLoadingAnalytics(true);
        const res = await api.get("/analytics/buyer");
        if (res.data.success) {
          const { summary, spendTrends, categoryDistribution, topFarmers } = res.data.data;
          setStats(summary);
          setSpendTrends(spendTrends || []);
          setCategoryDistribution(categoryDistribution || []);
          setTopFarmers(topFarmers || []);
        }
      } catch (err) {
        console.error("Failed to fetch general analytics", err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    if (user && user.activeRole === "BUYER") {
      fetchGeneralAnalytics();
    }
  }, [user]);

  // Fetch catalog to populate trend crop selector
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await api.get("/crops/catalog");
        if (res.data.success) {
          const list = res.data.catalog || [];
          setCatalogItems(list);
          if (list.length > 0) {
            setSelectedCrop(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch crop catalog", err);
      }
    };
    if (user && user.activeRole === "BUYER") {
      fetchCatalog();
    }
  }, [user]);

  // Fetch crop trends when selected crop changes
  useEffect(() => {
    const fetchCropTrends = async () => {
      if (!selectedCrop) return;
      try {
        setLoadingCropTrends(true);
        const res = await api.get(`/analytics/crop-trends?catalogId=${selectedCrop}`);
        if (res.data.success) {
          setCropTrendData(res.data.data.trends || []);
        }
      } catch (err) {
        console.error("Failed to fetch crop trends", err);
      } finally {
        setLoadingCropTrends(false);
      }
    };

    fetchCropTrends();
  }, [selectedCrop]);

  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    );
  }

  // --- SVG Line Chart Generator for Crop Trends (10 Months) ---
  const renderCropTrendChart = () => {
    if (cropTrendData.length === 0) return null;

    const width = 500;
    const height = 220;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const prices = cropTrendData.map(d => d.avgPrice);
    const maxVal = Math.max(...prices, 40) * 1.1;
    const minVal = Math.max(0, Math.min(...prices) * 0.9);
    const range = maxVal - minVal;

    const points = cropTrendData.map((d, index) => {
      const x = paddingLeft + (index / (cropTrendData.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((d.avgPrice - minVal) / range) * chartHeight;
      return { x, y, ...d };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      // Smooth curve calculation using cubic bezier control points
      const prev = points[i - 1];
      const curr = points[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 3;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (2 * (curr.x - prev.x)) / 3;
      const cpY2 = curr.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id="crop-trend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B5E20" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1B5E20" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = paddingTop + ratio * chartHeight;
          const val = maxVal - ratio * range;
          return (
            <g key={index}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#F1F3F0" strokeWidth="1" strokeDasharray="3,3" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-bold text-gray-400">
                ₹{Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Shaded Area */}
        <path d={areaD} fill="url(#crop-trend-gradient)" />

        {/* Trend Line */}
        <path d={pathD} fill="none" stroke="#1B5E20" strokeWidth="3" strokeLinecap="round" />

        {/* Data points & labels */}
        {points.map((p, index) => (
          <g key={index} className="group">
            <circle cx={p.x} cy={p.y} r="4" fill="#1B5E20" stroke="#FFFFFF" strokeWidth="2" className="transition-transform group-hover:scale-150 cursor-pointer" />
            
            {/* Tooltip on Hover */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              <rect x={p.x - 25} y={p.y - 28} width="50" height="18" rx="4" fill="#212121" />
              <text x={p.x} y={p.y - 16} textAnchor="middle" fill="#FFFFFF" className="text-[9px] font-bold">
                ₹{p.avgPrice}
              </text>
            </g>

            {/* X Axis labels */}
            {index % 2 === 0 && (
              <text x={p.x} y={height - 8} textAnchor="middle" className="text-[10px] font-bold text-gray-400">
                {p.month}
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  };

  // --- SVG Line Chart Generator for Spend Trends (6 Months) ---
  const renderSpendTrendChart = () => {
    if (spendTrends.length === 0) return null;

    const width = 500;
    const height = 220;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const amounts = spendTrends.map(d => d.spent);
    const maxVal = Math.max(...amounts, 1000) * 1.1;
    const minVal = 0;
    const range = maxVal - minVal;

    const points = spendTrends.map((d, index) => {
      const x = paddingLeft + (index / (spendTrends.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((d.spent - minVal) / range) * chartHeight;
      return { x, y, ...d };
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

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id="spend-trend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4CAF50" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = paddingTop + ratio * chartHeight;
          const val = maxVal - ratio * range;
          return (
            <g key={index}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#F1F3F0" strokeWidth="1" strokeDasharray="3,3" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-bold text-gray-400">
                ₹{Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Shaded Area */}
        <path d={areaD} fill="url(#spend-trend-gradient)" />

        {/* Trend Line */}
        <path d={pathD} fill="none" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />

        {/* Data points & labels */}
        {points.map((p, index) => (
          <g key={index} className="group">
            <circle cx={p.x} cy={p.y} r="4" fill="#4CAF50" stroke="#FFFFFF" strokeWidth="2" className="transition-transform group-hover:scale-150 cursor-pointer" />
            
            {/* Tooltip on Hover */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              <rect x={p.x - 30} y={p.y - 28} width="60" height="18" rx="4" fill="#212121" />
              <text x={p.x} y={p.y - 16} textAnchor="middle" fill="#FFFFFF" className="text-[9px] font-bold">
                ₹{p.spent}
              </text>
            </g>

            {/* X Axis labels */}
            <text x={p.x} y={height - 8} textAnchor="middle" className="text-[10px] font-bold text-gray-400">
              {p.month}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const selectedCropName = catalogItems.find(c => c.id === selectedCrop)?.englishName || "Vegetables";

  return (
    <div className="flex flex-col h-full bg-[#FAFBFA]">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 p-4 shrink-0 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dashboard/buyer")}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-[#1B5E20]">Analytics & Pricing Insights</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live platform insights</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:py-8">
        <div className="max-w-6xl mx-auto space-y-6">
        
        {/* KPI Scorecards */}
        {loadingAnalytics ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 h-28 animate-pulse shadow-sm"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Spent */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Spent</p>
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-[#1B5E20]" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-[#1B5E20]">₹{stats.totalSpent?.toLocaleString()}</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">For all completed deliveries</p>
              </div>
            </div>

            {/* Total Volume */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Volume</p>
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#1B5E20]" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-[#212121]">{stats.totalVolume?.toLocaleString()} kg</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">Total crops processed</p>
              </div>
            </div>

            {/* Total Savings */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Savings</p>
                <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#FFB300]" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-[#FFB300]">₹{stats.totalSavings?.toLocaleString()}</h3>
                <p className="text-[10px] text-green-600 font-bold mt-1">Saved vs avg market price</p>
              </div>
            </div>

            {/* Active Orders */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Active Orders</p>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black text-gray-800">{stats.activeOrders}</h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">Currently in progress</p>
              </div>
            </div>

          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Crop Trends - 10 Months (Takes 2 Columns) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-black text-[#212121] flex items-center gap-2">
                  <TrendingUp className="text-[#1B5E20]" size={20} /> Crop Price trends
                </h2>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Average platform market price per kg (last 10 months)</p>
              </div>

              {/* Crop Selector Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowCropDropdown(!showCropDropdown)}
                  className="flex items-center justify-between gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer w-44"
                >
                  <span className="truncate">{selectedCropName}</span>
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                </button>

                {showCropDropdown && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-40 max-h-56 overflow-y-auto">
                    {catalogItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedCrop(item.id);
                          setShowCropDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-gray-600 hover:bg-green-50/50 hover:text-[#1B5E20] flex items-center justify-between"
                      >
                        {item.englishName}
                        {selectedCrop === item.id && <Check size={12} className="text-[#1B5E20]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-60 relative w-full flex items-center justify-center">
              {loadingCropTrends ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div>
              ) : (
                renderCropTrendChart()
              )}
            </div>
          </div>

          {/* Spend Trends (1 Column) */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-black text-[#212121] flex items-center gap-2">
                <Calendar className="text-green-600" size={20} /> Spend Trends
              </h2>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Your monthly checkout spent (last 6 months)</p>
            </div>

            <div className="h-60 mt-6 relative w-full flex items-center justify-center">
              {loadingAnalytics ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              ) : (
                renderSpendTrendChart()
              )}
            </div>
          </div>

        </div>

        {/* Lower Row: Category distribution & Top Suppliers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Category Distribution (1 Column) */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="mb-6">
              <h2 className="text-base font-black text-[#212121]">Purchase Distribution</h2>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Budget share across crop categories</p>
            </div>

            {loadingAnalytics ? (
              <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded-lg"></div>
                ))}
              </div>
            ) : categoryDistribution.length > 0 ? (
              <div className="space-y-4 flex-1 flex flex-col justify-center">
                {categoryDistribution.map((cat, i) => {
                  const maxVal = Math.max(...categoryDistribution.map(c => c.value), 1);
                  const percentage = Math.round((cat.value / stats.totalSpent) * 100) || 0;
                  const colors = ["bg-orange-500", "bg-red-500", "bg-green-500", "bg-yellow-500", "bg-emerald-500"];
                  const barColor = colors[i % colors.length];

                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-600">
                        <span>{cat.category}</span>
                        <span>₹{cat.value?.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-50 rounded-full h-2">
                        <div 
                          className={`${barColor} h-2 rounded-full transition-all duration-1000`} 
                          style={{ width: `${(cat.value / maxVal) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 font-semibold text-xs flex-1 flex items-center justify-center">
                No category data available.
              </div>
            )}
          </div>

          {/* Top Suppliers (2 Columns) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="mb-6">
              <h2 className="text-base font-black text-[#212121] flex items-center gap-2">
                <Leaf className="text-[#1B5E20]" size={20} /> Top Farmers Network
              </h2>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">Farmers you frequently buy from and support</p>
            </div>

            {loadingAnalytics ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-2xl"></div>
                ))}
              </div>
            ) : topFarmers.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {topFarmers.map((farmer, index) => (
                  <div key={index} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-50/50 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-[#1B5E20]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#212121]">{farmer.name}</p>
                        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{farmer.orders} orders placed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-[#1B5E20]">₹{farmer.spent?.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Total spent</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 font-semibold text-xs flex-1 flex items-center justify-center">
                No transaction history to compute farmer network.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  </div>
  );
}
