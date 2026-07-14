"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '@/lib/axios';
import { 
  Search, ChevronDown, Filter,
  MoreVertical, Eye, Image as ImageIcon, CheckCircle, PauseCircle, Sprout, X, Edit2, UploadCloud, Trash2, ShieldCheck, AlertTriangle, UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  "VEGETABLES",
  "FRUITS",
  "GRAINS",
  "HERBS",
  "DAIRY",
  "PULSES",
  "OILSEEDS",
  "OTHER"
];

export default function CropCatalogTab() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortOrder, setSortOrder] = useState("Newest");

  // Add Form
  const [addForm, setAddForm] = useState({
    category: "",
    englishName: "",
    hindiName: "",
    isActive: true
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drawer
  const [selectedCrop, setSelectedCrop] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    category: "",
    englishName: "",
    hindiName: "",
    isActive: true
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/catalog');
      if (res.data.success) {
        setCatalog(res.data.catalog);
      }
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      if (isEdit) {
        setEditImageFile(file);
        setEditImagePreview(url);
      } else {
        setImageFile(file);
        setImagePreview(url);
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.category || !addForm.englishName || !addForm.hindiName) {
      alert("Please fill all required fields.");
      return;
    }
    
    setAdding(true);
    try {
      const formData = new FormData();
      formData.append("category", addForm.category);
      formData.append("englishName", addForm.englishName);
      formData.append("hindiName", addForm.hindiName);
      formData.append("isActive", addForm.isActive.toString());
      if (imageFile) formData.append("imageTemplate", imageFile);

      const res = await api.post('/admin/catalog', formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        alert("Crop added successfully!");
        setAddForm({ category: "", englishName: "", hindiName: "", isActive: true });
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchCatalog();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add crop.");
    } finally {
      setAdding(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedCrop) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("category", editForm.category);
      formData.append("englishName", editForm.englishName);
      formData.append("hindiName", editForm.hindiName);
      formData.append("isActive", editForm.isActive.toString());
      if (editImageFile) formData.append("imageTemplate", editImageFile);

      const res = await api.patch(`/admin/catalog/${selectedCrop.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        alert("Crop updated successfully!");
        setIsDrawerOpen(false);
        fetchCatalog();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update crop.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (crop: any) => {
    if (!confirm(`Are you sure you want to ${crop.isActive ? 'disable' : 'enable'} ${crop.englishName}?`)) return;
    try {
      const res = await api.patch(`/admin/catalog/${crop.id}`, { isActive: !crop.isActive });
      if (res.data.success) {
        fetchCatalog();
        if (selectedCrop && selectedCrop.id === crop.id) {
          setIsDrawerOpen(false);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to toggle status.");
    }
  };

  const handleDelete = async (crop: any) => {
    if (crop.stats && crop.stats.totalFarmersUsing > 0) {
      alert("Cannot delete crop. It is currently being used by farmers.");
      return;
    }
    if (!confirm(`Are you sure you want to delete ${crop.englishName}? This action cannot be undone.`)) return;
    
    try {
      const res = await api.delete(`/admin/catalog/${crop.id}`);
      if (res.data.success) {
        alert("Crop deleted successfully.");
        fetchCatalog();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete crop.");
    }
  };

  const openDrawer = (crop: any) => {
    setSelectedCrop(crop);
    setEditForm({
      category: crop.category,
      englishName: crop.englishName,
      hindiName: crop.hindiName,
      isActive: crop.isActive
    });
    setEditImageFile(null);
    setEditImagePreview(crop.imageTemplate || null);
    setIsDrawerOpen(true);
  };

  // Derived Metrics
  const totalCrops = catalog.length;
  const activeCrops = catalog.filter(c => c.isActive).length;
  const disabledCrops = totalCrops - activeCrops;
  const totalCategories = new Set(catalog.map(c => c.category)).size;

  // Filtering & Sorting
  const filteredCatalog = useMemo(() => {
    let filtered = catalog;

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.englishName.toLowerCase().includes(lowerQ) || 
        c.hindiName.toLowerCase().includes(lowerQ)
      );
    }

    if (categoryFilter !== "All Categories") {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }

    if (statusFilter === "Active") {
      filtered = filtered.filter(c => c.isActive);
    } else if (statusFilter === "Disabled") {
      filtered = filtered.filter(c => !c.isActive);
    }

    if (sortOrder === "Newest") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOrder === "A-Z") {
      filtered.sort((a, b) => a.englishName.localeCompare(b.englishName));
    }

    return filtered;
  }, [catalog, searchQuery, categoryFilter, statusFilter, sortOrder]);


  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center shrink-0">
            <Sprout className="w-6 h-6 text-[#1B5E20]" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Total Categories</p>
            <p className="text-2xl font-black text-gray-800">{loading ? "..." : totalCategories}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
            <Sprout className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Total Crops</p>
            <p className="text-2xl font-black text-gray-800">{loading ? "..." : totalCrops}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Active Crops</p>
            <p className="text-2xl font-black text-gray-800">{loading ? "..." : activeCrops}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
            <PauseCircle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">Disabled Crops</p>
            <p className="text-2xl font-black text-gray-800">{loading ? "..." : disabledCrops}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* ── Left Sidebar (Add Form) ── */}
        <div className="w-full lg:w-[350px] shrink-0 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#1B5E20]" />
              Add New Crop
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20] appearance-none"
                    value={addForm.category}
                    onChange={(e) => setAddForm({...addForm, category: e.target.value})}
                    required
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Hindi Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="जैसे: भिंडी"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]"
                  value={addForm.hindiName}
                  onChange={(e) => setAddForm({...addForm, hindiName: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">English Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. Ladyfinger (Okra)"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]"
                  value={addForm.englishName}
                  onChange={(e) => setAddForm({...addForm, englishName: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Crop Image</label>
                <div className="flex gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-24 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors"
                  >
                    <UploadCloud className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-[10px] font-bold text-gray-500">Upload image</span>
                    <span className="text-[9px] font-semibold text-gray-400">PNG, JPG or WEBP</span>
                    <span className="text-[9px] font-semibold text-gray-400 mt-0.5">Standard: 500x500px</span>
                  </div>
                  {imagePreview && (
                    <div className="w-24 h-24 rounded-xl border border-gray-200 overflow-hidden shrink-0 relative">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, false)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Status</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${addForm.isActive ? 'border-[#1B5E20] bg-[#1B5E20]' : 'border-gray-300'}`}>
                      {addForm.isActive && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Active</span>
                    <input type="radio" className="hidden" checked={addForm.isActive} onChange={() => setAddForm({...addForm, isActive: true})} />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!addForm.isActive ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                      {!addForm.isActive && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Disabled</span>
                    <input type="radio" className="hidden" checked={!addForm.isActive} onChange={() => setAddForm({...addForm, isActive: false})} />
                  </label>
                </div>
              </div>

              <button 
                disabled={adding}
                className="w-full py-3 bg-[#1B5E20] text-white font-bold rounded-xl mt-4 hover:bg-[#144a19] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {adding ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>+ Add Crop</>
                )}
              </button>
            </form>

            <div className="mt-4 p-3 bg-green-50 rounded-xl flex gap-3 items-start border border-green-100">
              <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-green-700" />
              </div>
              <p className="text-[11px] font-semibold text-green-800 leading-snug">
                Tip: Use a clear and high-quality image. This will be displayed across the platform to farmers and buyers.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Content (Grid & Filters) ── */}
        <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[600px]">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-xl font-black text-gray-800">All Crops</h3>
              <p className="text-xs font-semibold text-gray-500">{filteredCatalog.length} crops found</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search crops..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <select 
                  className="pl-4 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none appearance-none hover:bg-gray-50 cursor-pointer"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All Categories">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  className="pl-4 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none appearance-none hover:bg-gray-50 cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All Status">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  className="pl-4 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none appearance-none hover:bg-gray-50 cursor-pointer"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="Newest">Sort by: Newest</option>
                  <option value="A-Z">Sort by: A-Z</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Grid View */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B5E20]"></div>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <Sprout className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-800">No crops found</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 flex-1 content-start overflow-y-auto pr-2 pb-4">
              {filteredCatalog.map(crop => (
                <div key={crop.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                  {/* Image & Status Badge */}
                  <div className="relative h-36 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {crop.imageTemplate ? (
                      <img src={crop.imageTemplate} alt={crop.englishName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-gray-300" />
                    )}
                    <div className="absolute top-3 right-3">
                      {crop.isActive ? (
                        <span className="px-2 py-1 bg-green-50/90 backdrop-blur border border-green-200 text-green-700 text-[10px] font-black uppercase rounded-lg shadow-sm flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-50/90 backdrop-blur border border-amber-200 text-amber-700 text-[10px] font-black uppercase rounded-lg shadow-sm flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-black text-gray-800 text-base leading-tight truncate">{crop.englishName}</h4>
                    <p className="text-sm font-semibold text-gray-500 mb-3 truncate">{crop.hindiName}</p>
                    
                    <div className="mt-auto">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md text-[10px] font-bold text-gray-600">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          crop.category === 'VEGETABLES' ? 'bg-green-500' :
                          crop.category === 'FRUITS' ? 'bg-red-500' :
                          crop.category === 'GRAINS' ? 'bg-amber-500' : 'bg-blue-500'
                        }`}></div>
                        {crop.category.charAt(0) + crop.category.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={() => openDrawer(crop)} className="py-2.5 flex items-center justify-center hover:bg-white hover:text-[#1B5E20] transition-colors border-r border-gray-100 group/btn">
                      <Eye className="w-4 h-4 text-gray-400 group-hover/btn:text-[#1B5E20]" />
                    </button>
                    <button onClick={() => openDrawer(crop)} className="py-2.5 flex items-center justify-center hover:bg-white hover:text-blue-600 transition-colors border-r border-gray-100 group/btn">
                      <Edit2 className="w-4 h-4 text-gray-400 group-hover/btn:text-blue-600" />
                    </button>
                    <button onClick={() => handleDelete(crop)} className="py-2.5 flex items-center justify-center hover:bg-white hover:text-red-500 transition-colors group/btn">
                      <Trash2 className="w-4 h-4 text-gray-400 group-hover/btn:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Drawer ── */}
      <AnimatePresence>
        {isDrawerOpen && selectedCrop && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-[70] border-l border-gray-100 flex flex-col"
            >
              {/* Header */}
              <div className="h-20 px-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black text-gray-800">Edit Crop</h3>
                <button onClick={() => setIsDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Image Section */}
                <div className="flex gap-4">
                  <div className="w-32 h-32 rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0 relative group">
                    {editImagePreview ? (
                      <img src={editImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-300" /></div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <button 
                      onClick={() => editFileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <UploadCloud className="w-4 h-4" /> Change Image
                    </button>
                    <span className="text-[10px] font-semibold text-gray-400 text-center">Standard: 500x500px</span>
                    {editImagePreview && (
                      <button 
                        onClick={() => { setEditImageFile(null); setEditImagePreview(null); if(editFileInputRef.current) editFileInputRef.current.value = ""; }}
                        className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        Remove Image
                      </button>
                    )}
                    <input type="file" ref={editFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-800 border-b border-gray-100 pb-2">Basic Information</h4>
                  
                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">English Name</span>
                    <input type="text" className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1B5E20]" value={editForm.englishName} onChange={(e) => setEditForm({...editForm, englishName: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Hindi Name</span>
                    <input type="text" className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1B5E20]" value={editForm.hindiName} onChange={(e) => setEditForm({...editForm, hindiName: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Category</span>
                    <div className="col-span-2 relative">
                      <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1B5E20] appearance-none" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Status</span>
                    <div className="col-span-2 flex items-center gap-4">
                      {editForm.isActive ? (
                        <span className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold uppercase rounded-lg">Active</span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase rounded-lg">Disabled</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-xs font-bold text-gray-500">Created At</span>
                    <span className="col-span-2 text-sm font-semibold text-gray-800">{new Date(selectedCrop.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-800 border-b border-gray-100 pb-2">Usage Statistics</h4>
                  
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-xs font-bold text-gray-600"><UserIcon className="w-4 h-4 text-gray-400" /> Total Farmers Using</span>
                      <span className="text-sm font-black text-gray-800">{selectedCrop.stats?.totalFarmersUsing || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-xs font-bold text-gray-600"><Sprout className="w-4 h-4 text-gray-400" /> Active Listings</span>
                      <span className="text-sm font-black text-gray-800">{selectedCrop.stats?.activeListings || 0}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-100 bg-white shrink-0 space-y-3">
                <div className="flex gap-3">
                  <button onClick={() => handleToggleStatus(selectedCrop)} className="flex-1 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                    {editForm.isActive ? <PauseCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {editForm.isActive ? "Disable Crop" : "Enable Crop"}
                  </button>
                  <button onClick={() => handleDelete(selectedCrop)} className="flex-1 py-3 bg-red-50 border border-red-100 rounded-xl text-sm font-bold text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete Crop
                  </button>
                </div>
                <button onClick={handleEditSubmit} disabled={saving} className="w-full py-3 bg-[#1B5E20] text-white rounded-xl text-sm font-bold hover:bg-[#144a19] transition-colors disabled:opacity-70 flex justify-center items-center">
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Save Changes"}
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
