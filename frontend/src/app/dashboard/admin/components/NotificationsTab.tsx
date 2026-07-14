"use client";
import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/axios';
import { 
  Megaphone, Gift, AlertTriangle, Wrench, ChevronDown, 
  Send, CheckCircle2, XCircle, Search, User, Filter, Calendar, X, Bell, UserCheck
} from 'lucide-react';

export default function NotificationsTab() {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  // Compose State
  const [sendTo, setSendTo] = useState("All Users");
  const [notifType, setNotifType] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  
  // Specific User State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Drawer State
  const [previewNotif, setPreviewNotif] = useState<any | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/admin/notifications/history');
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedUser(null);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/users/search?q=${val}`);
        if (res.data.success) {
          setSearchResults(res.data.data);
        }
      } catch (error) {
        console.error("Search error", error);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Title and message are required.");
      return;
    }

    if (sendTo === "Specific Users" && !selectedUser) {
      alert("Please search and select a specific user.");
      return;
    }

    setLoadingSend(true);
    try {
      const res = await api.post('/admin/notifications/send', {
        sendTo,
        userId: selectedUser?.id,
        type: notifType,
        title,
        message
      });

      if (res.data.success) {
        alert("Notification sent successfully!");
        setTitle("");
        setMessage("");
        setSearchQuery("");
        setSelectedUser(null);
        fetchHistory();
      } else {
        alert("Failed to send notification: " + res.data.message);
      }
    } catch (error: any) {
      alert("An error occurred: " + (error.response?.data?.message || error.message));
    } finally {
      setLoadingSend(false);
    }
  };

  const getIconForType = (type: string, className = "w-5 h-5") => {
    switch (type) {
      case 'ANNOUNCEMENT': return <Megaphone className={className} />;
      case 'OFFER': return <Gift className={className} />;
      case 'WARNING': return <AlertTriangle className={className} />;
      case 'MAINTENANCE': return <Wrench className={className} />;
      case 'GENERAL':
      default: return <Bell className={className} />;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'ANNOUNCEMENT': return "text-purple-600 bg-purple-50 border-purple-100";
      case 'OFFER': return "text-green-600 bg-green-50 border-green-100";
      case 'WARNING': return "text-red-600 bg-red-50 border-red-100";
      case 'MAINTENANCE': return "text-blue-600 bg-blue-50 border-blue-100";
      case 'GENERAL':
      default: return "text-gray-600 bg-gray-50 border-gray-100";
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 pb-10 relative">
      
      {/* TOP SECTION: Compose */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full shrink-0">
        <h2 className="text-lg font-black text-gray-900 mb-6">Compose Notification</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inputs Section */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column Inputs */}
            <div className="space-y-5">
              {/* Send To */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Send To</label>
                <div className="relative">
                  <select 
                    value={sendTo}
                    onChange={(e) => { setSendTo(e.target.value); setSelectedUser(null); setSearchQuery(""); }}
                    className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                  >
                    <option value="All Users">All Users</option>
                    <option value="All Buyers">All Buyers</option>
                    <option value="All Farmers">All Farmers</option>
                    <option value="All Delivery Partners">All Delivery Partners</option>
                    <option value="Specific Users">Specific Users</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Specific User Search (Only if Selected) */}
              {sendTo === "Specific Users" && (
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Search User</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Enter name, phone, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                    />
                    {isSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>}
                  </div>

                  {/* Dropdown Results */}
                  {searchResults.length > 0 && !selectedUser && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map(user => (
                        <div 
                          key={user.id}
                          onClick={() => { setSelectedUser(user); setSearchQuery(user.name || user.phone || user.id); setSearchResults([]); }}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{user.name || "Unknown User"}</p>
                            <p className="text-xs text-gray-500">{user.phone} • {user.roles?.join(', ')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notification Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Notification Type</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                    {getIconForType(notifType, "w-4 h-4")}
                  </div>
                  <select 
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value)}
                    className="w-full appearance-none pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                    <option value="WARNING">WARNING</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFFER">OFFER</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right Column Inputs */}
            <div className="space-y-5 flex flex-col">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700">Title</label>
                  <span className="text-[10px] text-gray-400 font-semibold">{title.length}/80</span>
                </div>
                <input 
                  type="text" 
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notification title"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20]"
                />
              </div>

              {/* Message */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700">Message</label>
                  <span className="text-[10px] text-gray-400 font-semibold">{message.length}/500</span>
                </div>
                <textarea 
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Type your notification message here..."
                  className="w-full flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Preview & Send Section */}
          <div className="lg:col-span-1 flex flex-col justify-end border-t lg:border-t-0 lg:border-l border-gray-100 pt-6 lg:pt-0 lg:pl-8">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Preview</h3>
            
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 mb-6">
              <div className="flex gap-4 items-start">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${getColorForType(notifType)}`}>
                  {getIconForType(notifType, "w-5 h-5")}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-gray-900 leading-tight mb-2">
                    {title || "Notification Title"}
                  </h4>
                  <p className="text-xs font-medium text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                    {message || "Type your notification message here to see a preview."}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSend}
              disabled={loadingSend}
              className="w-full bg-[#1B5E20] hover:bg-[#144716] disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loadingSend ? "Sending..." : (
                <>
                  <Send className="w-4 h-4" /> Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: History Table */}
      <div className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[400px]`}>
        
        {/* Table Header & Filters */}
        <div className="p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-900">Notification History</h2>
            <button onClick={fetchHistory} className="text-sm font-bold text-[#1B5E20] hover:underline">
              Refresh
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <select className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none">
              <option>All Types</option>
              <option>GENERAL</option>
              <option>ANNOUNCEMENT</option>
              <option>WARNING</option>
            </select>
            <select className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none">
              <option>All Recipients</option>
              <option>Farmers</option>
              <option>Buyers</option>
              <option>Delivery</option>
            </select>
            <select className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 outline-none">
              <option>All Status</option>
              <option>Delivered</option>
              <option>Failed</option>
            </select>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>Last 7 Days</span>
            </div>
            <button className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loadingHistory ? (
            <div className="p-8 text-center text-sm font-semibold text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-gray-500">No notifications found in history.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Title</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Recipient</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Sent On</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((notif, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${getColorForType(notif.type)}`}>
                        {getIconForType(notif.type, "w-4 h-4")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setPreviewNotif(notif)}
                        className="text-sm font-bold text-[#1B5E20] hover:underline text-left"
                      >
                        {notif.title}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-medium">
                        {Number(notif.sentCount)} Users
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-medium">
                        {new Date(notif.sentOn).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-bold border border-green-100">
                        <CheckCircle2 className="w-3 h-3" /> Delivered
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Side Drawer for Notification Preview */}
      {previewNotif && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setPreviewNotif(null)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 flex items-start justify-between border-b border-gray-100">
              <div className="flex gap-4 items-start">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${getColorForType(previewNotif.type)}`}>
                  {getIconForType(previewNotif.type, "w-6 h-6")}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-lg leading-tight mb-2">{previewNotif.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold border border-green-100">
                      Delivered
                    </span>
                    <span className="text-xs font-semibold text-gray-400">
                      ID: NOTF-{new Date(previewNotif.sentOn).getTime().toString().slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setPreviewNotif(null)}
                className="p-2 -mr-2 -mt-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Message Block */}
              <div className="mb-8">
                <h4 className="text-xs font-black text-gray-900 mb-3 uppercase tracking-wider">Message</h4>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {previewNotif.body}
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <UserCheck className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recipient</p>
                    <p className="text-sm font-semibold text-gray-900">{Number(previewNotif.sentCount)} Users</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Calendar className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sent On</p>
                    <p className="text-sm font-semibold text-gray-900">{new Date(previewNotif.sentOn).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Megaphone className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Type</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getColorForType(previewNotif.type)}`}>
                      {previewNotif.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Status Summary */}
              <div className="mt-10">
                <h4 className="text-xs font-black text-gray-900 mb-4 uppercase tracking-wider">Delivery Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl flex flex-col items-center justify-center text-center">
                    <Send className="w-5 h-5 text-blue-500 mb-2" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Sent</p>
                    <p className="text-lg font-black text-gray-900">{Number(previewNotif.sentCount)}</p>
                  </div>
                  <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl flex flex-col items-center justify-center text-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Delivered</p>
                    <p className="text-lg font-black text-gray-900">{Number(previewNotif.sentCount)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
