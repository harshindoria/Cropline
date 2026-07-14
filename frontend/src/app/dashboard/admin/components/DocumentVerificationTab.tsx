"use client";
import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/axios';
import { 
  Users, ShieldCheck, FileText, FileCheck, Clock,
  ChevronDown, 
  ChevronLeft, ChevronRight, Check, X, AlertTriangle
} from 'lucide-react';

const PAGE_SIZE = 8;

export default function DocumentVerificationTab() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [activeTab, setActiveTab] = useState("Pending Review");
  const [searchQuery, setSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("All Document Types");
  const [userTypeFilter, setUserTypeFilter] = useState("All Users");
  const [dateFilter, setDateFilter] = useState("Newest First");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selected doc & image viewer
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/documents');
      if (res.data.success) {
        setDocuments(res.data.documents || []);
        setMetrics(res.data.metrics || null);
      } else {
        setError("Failed to fetch documents data.");
      }
    } catch (err: any) {
      console.error("Failed to fetch documents:", err);
      setError(err?.response?.data?.message || "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      if (activeTab === "Pending Review" && doc.status !== "Pending") return false;
      if (activeTab === "Approved" && doc.status !== "Approved") return false;
      if (activeTab === "Rejected" && doc.status !== "Rejected") return false;

      const q = searchQuery.toLowerCase().trim();
      if (q && !(
        (doc.applicantName && doc.applicantName.toLowerCase().includes(q)) ||
        (doc.applicantPhone && doc.applicantPhone.includes(q))
      )) return false;

      if (docTypeFilter !== "All Document Types" && doc.docType !== docTypeFilter) return false;
      if (userTypeFilter !== "All Users" && doc.userType !== userTypeFilter) return false;

      return true;
    });

    if (dateFilter === "Newest First") {
      filtered.sort((a, b) => new Date(b.submittedOn).getTime() - new Date(a.submittedOn).getTime());
    } else {
      filtered.sort((a, b) => new Date(a.submittedOn).getTime() - new Date(b.submittedOn).getTime());
    }

    return filtered;
  }, [documents, activeTab, searchQuery, docTypeFilter, userTypeFilter, dateFilter]);

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE) || 1;
  const pagedDocuments = filteredDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedDoc(null);
  }, [searchQuery, docTypeFilter, userTypeFilter, dateFilter, activeTab]);

  const handleVerify = async (status: boolean) => {
    if (!selectedDoc) return;
    try {
      setActionLoading(true);
      const res = await api.post('/admin/documents/verify', {
        userId: selectedDoc.userId,
        docType: selectedDoc.docTypeEnum,
        status
      });
      if (res.data.success) {
        await fetchDocuments();
        setSelectedDoc(null);
        setRejectNote("");
      }
    } catch (err) {
      console.error("Action failed", err);
      alert("Failed to update document status.");
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(d);
  };

  const pendingCount = documents.filter(d => d.status === "Pending").length;
  const approvedCount = documents.filter(d => d.status === "Approved").length;
  const rejectedCount = documents.filter(d => d.status === "Rejected").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Document Verification</h2>
        <p className="text-sm font-semibold text-gray-500 mt-1">Review and verify documents submitted by farmers and delivery partners.</p>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center border-b border-gray-200">
        {[
          { name: "Pending Review", count: pendingCount },
          { name: "Approved", count: approvedCount },
          { name: "Rejected", count: rejectedCount }
        ].map(tab => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-bold text-sm ${
              activeTab === tab.name
                ? "border-[#1B5E20] text-[#1B5E20]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.name}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === tab.name ? "bg-green-100 text-[#1B5E20]" : "bg-gray-100 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-orange-50/60 rounded-2xl p-5 border border-orange-100 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white shadow-sm border border-orange-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Total Pending</p>
            <div className="flex items-end gap-1.5">
              <h3 className="text-2xl font-black text-gray-900">{metrics?.totalPending ?? 0}</h3>
              <p className="text-xs font-semibold text-gray-400 mb-0.5">Applications</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#1B5E20]" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Farmers (Aadhar)</p>
            <div className="flex items-end gap-1.5">
              <h3 className="text-2xl font-black text-gray-900">{metrics?.pendingAadhaar ?? 0}</h3>
              <p className="text-xs font-semibold text-gray-400 mb-0.5">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Delivery (License)</p>
            <div className="flex items-end gap-1.5">
              <h3 className="text-2xl font-black text-gray-900">{metrics?.pendingDl ?? 0}</h3>
              <p className="text-xs font-semibold text-gray-400 mb-0.5">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-4 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <FileCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Delivery Boys (RC)</p>
            <div className="flex items-end gap-1.5">
              <h3 className="text-2xl font-black text-gray-900">{metrics?.pendingRc ?? 0}</h3>
              <p className="text-xs font-semibold text-gray-400 mb-0.5">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select
            value={docTypeFilter}
            onChange={e => setDocTypeFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] transition-colors cursor-pointer"
          >
            <option>All Document Types</option>
            <option>Aadhar Card</option>
            <option>Driving License</option>
            <option>RC (Vehicle)</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={userTypeFilter}
            onChange={e => setUserTypeFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] transition-colors cursor-pointer"
          >
            <option>All Users</option>
            <option>Farmer</option>
            <option>Delivery Boy</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] transition-colors cursor-pointer"
          >
            <option>Newest First</option>
            <option>Oldest First</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Table */}
        <div className="flex-1 w-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#FAFBFA]">
            <h3 className="font-bold text-lg text-gray-800">Pending Verifications</h3>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 font-semibold flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin"></div>
              Loading documents...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500 font-semibold flex items-center justify-center gap-2">
              <AlertTriangle size={18} /> {error}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-semibold">No documents found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-6">Applicant</th>
                      <th className="py-3 px-6">User Type</th>
                      <th className="py-3 px-6">Document Type</th>
                      <th className="py-3 px-6">Submitted On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedDocuments.map(doc => (
                      <tr
                        key={doc.id}
                        onClick={() => { setSelectedDoc(doc); setRejectNote(""); }}
                        className={`transition-colors cursor-pointer ${selectedDoc?.id === doc.id ? 'bg-green-50/70 border-l-4 border-l-[#1B5E20]' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${doc.userType === 'Farmer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {getInitials(doc.applicantName)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{doc.applicantName || "Unknown"}</p>
                              <p className="text-xs font-medium text-gray-400 truncate">{doc.applicantPhone || "No phone"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            doc.userType === 'Farmer' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {doc.userType}
                          </span>
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            {doc.docTypeEnum === 'aadhaar' && <FileText className="w-4 h-4 text-orange-400" />}
                            {doc.docTypeEnum === 'dl' && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                            {doc.docTypeEnum === 'rc' && <FileCheck className="w-4 h-4 text-purple-500" />}
                            {doc.docType}
                          </div>
                        </td>
                        <td className="py-3.5 px-6">
                          <p className="text-sm font-semibold text-gray-600">{formatDate(doc.submittedOn)}</p>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded mt-1 inline-block ${
                            doc.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            doc.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-[#FAFBFA] rounded-b-3xl">
                <p className="text-sm font-semibold text-gray-500">
                  Showing <span className="text-gray-900 font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)}</span> of <span className="text-gray-900 font-bold">{filteredDocuments.length}</span> results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                        currentPage === i + 1 ? "bg-[#1B5E20] text-white" : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Document Image Viewer (like screenshot) */}
        {selectedDoc && (
          <div className="w-full lg:w-[380px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-[#FAFBFA]">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${selectedDoc.userType === 'Farmer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {getInitials(selectedDoc.applicantName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-gray-900 truncate">{selectedDoc.applicantName}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${selectedDoc.userType === 'Farmer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedDoc.userType}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-400 truncate">{selectedDoc.applicantPhone} {selectedDoc.applicantEmail ? `• ${selectedDoc.applicantEmail}` : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              {/* Document Type */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Document Type</p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
                    {selectedDoc.docTypeEnum === 'aadhaar' && <FileText className="w-4 h-4 text-orange-400" />}
                    {selectedDoc.docTypeEnum === 'dl' && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                    {selectedDoc.docTypeEnum === 'rc' && <FileCheck className="w-4 h-4 text-purple-500" />}
                    {selectedDoc.docType}
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    selectedDoc.status === 'Approved' ? 'bg-green-100 text-green-700' :
                    selectedDoc.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedDoc.status}
                  </span>
                </div>
              </div>

              {/* Submitted On */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Submitted On</p>
                <p className="text-sm font-bold text-gray-900">{formatDate(selectedDoc.submittedOn)}</p>
              </div>

              {/* Document Image */}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Document Preview</p>
                {selectedDoc.docUrl ? (
                  <div className="rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50">
                    <img
                      src={selectedDoc.docUrl}
                      alt={`${selectedDoc.docType} - ${selectedDoc.applicantName}`}
                      className="w-full object-contain max-h-80"
                    />
                  </div>
                ) : (
                  <div className="w-full h-44 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center bg-gray-50">
                    <FileText className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-400">No document image uploaded</p>
                    <p className="text-[10px] text-gray-300 mt-1">The applicant has not uploaded a document image yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {selectedDoc.status === "Pending" && (
              <div className="p-5 border-t border-gray-100 bg-white space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerify(true)}
                    disabled={actionLoading}
                    className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleVerify(false)}
                    disabled={actionLoading}
                    className="flex-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                    Reject
                  </button>
                </div>
                <input
                  type="text"
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Add a note (optional)..."
                  className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] transition-all"
                />
              </div>
            )}
            {selectedDoc.status === "Approved" && (
              <div className="p-5 border-t border-gray-100">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                  <Check className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-bold text-green-700">This document has been approved.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
