"use client";

import React, { useState, useRef } from "react";
import { 
  X, Tractor, Truck, CheckCircle2, ChevronRight, Check, 
  Upload, Camera, FileText
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LocationSelector, { LocationValue } from "./LocationSelector";

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "FARMER" | "DELIVERY" | null;
}

const EQUIPMENT_LIST = [
  { id: "tractor", label: "Tractor", emoji: "🚜" },
  { id: "harvester", label: "Harvester", emoji: "🌾" },
  { id: "irrigation", label: "Irrigation System", emoji: "💧" },
  { id: "tiller", label: "Tiller / Cultivator", emoji: "⚙️" },
  { id: "sprayer", label: "Pesticide Sprayer", emoji: "🧴" },
  { id: "thresher", label: "Thresher", emoji: "🏭" },
  { id: "storage", label: "Storage / Silo", emoji: "🏚️" },
  { id: "coldchain", label: "Cold Chain Unit", emoji: "❄️" },
];

const SEASONS = [
  { id: "kharif", label: "Kharif", sub: "Jun – Oct", emoji: "☀️" },
  { id: "rabi", label: "Rabi", sub: "Nov – Apr", emoji: "🌾" },
  { id: "zaid", label: "Zaid", sub: "Mar – Jun", emoji: "🌿" },
];

export default function ApplicationModal({ isOpen, onClose, role }: ApplicationModalProps) {
  const { onboardNewRole, completeRegistration, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const licencePhotoRef = useRef<HTMLInputElement>(null);

  // ─── Shared Fields ─────────────────────────────────────────
  const [name, setName] = useState(user?.name || "");
  const [aadhaar, setAadhaar] = useState(user?.aadhaarLast4 || "");
  const [locationData, setLocationData] = useState<LocationValue>({
    state: user?.state || "",
    district: user?.district || "",
    village: user?.village || "",
    pincode: user?.pincode || "",
  });
  const [farmArea, setFarmArea] = useState("");
  const [experience, setExperience] = useState("");
  const [primaryCrops, setPrimaryCrops] = useState("");
  const [farmingType, setFarmingType] = useState("");
  const [soilType, setSoilType] = useState("");
  const [waterSource, setWaterSource] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);

  // ─── Delivery Specific ─────────────────────────────────────
  const [vehicleType, setVehicleType] = useState("BIKE");
  const [licenceId, setLicenceId] = useState("");
  const [licencePhoto, setLicencePhoto] = useState<File | null>(null);
  const [licencePreview, setLicencePreview] = useState<string | null>(null);

  if (!isOpen || !role) return null;

  const accentColor = role === "FARMER" ? "#1B5E20" : "#E65100";
  const accentRing = role === "FARMER" ? "focus:border-[#1B5E20] focus:ring-[#1B5E20]" : "focus:border-[#E65100] focus:ring-[#E65100]";
  const accentBg = role === "FARMER" ? "bg-[#1B5E20] hover:bg-[#2E7D32]" : "bg-[#E65100] hover:bg-[#EF6C00]";
  const accentBorder = role === "FARMER" ? "border-[#1B5E20] bg-[#eef7ef]" : "border-[#E65100] bg-orange-50/50";

  const toggleEquipment = (id: string) => {
    setSelectedEquipment(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleSeason = (id: string) => {
    setSelectedSeasons(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleLicencePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicencePhoto(file);
    const reader = new FileReader();
    reader.onload = () => setLicencePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await completeRegistration({
        name,
        village: locationData.village,
        district: locationData.district,
        state: locationData.state,
        pincode: locationData.pincode,
        aadhaarLast4: aadhaar,
        farmArea: role === "FARMER" ? parseFloat(farmArea) : null,
      });
      
      const additionalData = role === "FARMER" ? {
        primaryCrops,
        farmingType,
        soilType,
        waterSource
      } : {
        vehicleType
      };

      await onboardNewRole(role, additionalData);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Failed to submit application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-[family-name:var(--font-poppins)]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-3xl w-full max-w-lg z-10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Header ───────────────────────────────────────── */}
        <div className={`p-6 text-white shrink-0`} style={{ background: accentColor }}>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>

          <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            {role === "FARMER" ? <Tractor className="w-5 h-5 text-white" /> : <Truck className="w-5 h-5 text-white" />}
          </div>
          <h2 className="text-xl font-black mb-1">
            {role === "FARMER" ? "Farmer Application" : "Delivery Partner Application"}
          </h2>
          <p className="text-white/75 text-sm font-semibold">
            {role === "FARMER"
              ? "Fill in your farming details to start selling on CropLine."
              : "Tell us about your vehicle to start earning with CropLine."}
          </p>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-6">
          {submitted ? (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-black text-[#212121] mb-2">Application Submitted!</h3>
              <p className="text-sm font-semibold text-gray-500 mb-8 leading-relaxed">
                Your application is under review. Our admin team will verify your details and notify you once approved.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
              >
                Close & Return
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Shared: Name ─── */}
              <div>
                <label className="text-xs font-bold text-[#424242] block mb-1.5">Full Name</label>
                <input
                  required type="text" placeholder="e.g. Ramesh Yadav"
                  value={name} onChange={e => setName(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                />
              </div>

              {/* ══════════════ FARMER SPECIFIC ══════════════ */}
              {role === "FARMER" && (
                <>
                  {/* Farm Area + Experience */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Farm Area (Acres)</label>
                      <input
                        required type="number" min={0.1} step={0.1} placeholder="e.g. 5.5"
                        value={farmArea} onChange={e => setFarmArea(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Experience (Years)</label>
                      <input
                        required type="number" min={0} placeholder="e.g. 10"
                        value={experience} onChange={e => setExperience(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                  </div>

                  {/* Village */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-1.5">Village / Farm Address</label>
                    <input
                      required type="text" placeholder="e.g. Kalyanpura"
                      value={locationData.village} onChange={e => setLocationData(prev => ({ ...prev, village: e.target.value }))}
                      className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                    />
                  </div>

                  {/* New Farm Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Primary Crops</label>
                      <input
                        required type="text" placeholder="Wheat, Bajra, Mustard"
                        value={primaryCrops} onChange={e => setPrimaryCrops(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Farming Type</label>
                      <input
                        required type="text" placeholder="e.g. Organic, Conventional"
                        value={farmingType} onChange={e => setFarmingType(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Soil Type</label>
                      <input
                        required type="text" placeholder="e.g. Loamy, Clay"
                        value={soilType} onChange={e => setSoilType(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#424242] block mb-1.5">Water Source</label>
                      <input
                        required type="text" placeholder="e.g. Tube Well, Rain"
                        value={waterSource} onChange={e => setWaterSource(e.target.value)}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                      />
                    </div>
                  </div>

                  {/* Equipment */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-2">
                      Equipment Available
                      <span className="text-gray-400 font-semibold ml-1">(Select all that you own)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EQUIPMENT_LIST.map(eq => {
                        const active = selectedEquipment.includes(eq.id);
                        return (
                          <div
                            key={eq.id}
                            onClick={() => toggleEquipment(eq.id)}
                            className={`border rounded-xl px-3 py-2.5 cursor-pointer transition-all flex items-center gap-2 ${
                              active ? accentBorder + " border" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-base">{eq.emoji}</span>
                            <span className={`text-xs font-bold flex-1 ${active ? `text-[${accentColor}]` : "text-gray-600"}`}>
                              {eq.label}
                            </span>
                            {active && <Check size={13} style={{ color: accentColor }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Seasons */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-2">
                      Which seasons can you supply crops?
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {SEASONS.map(s => {
                        const active = selectedSeasons.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleSeason(s.id)}
                            className={`border rounded-xl p-3 cursor-pointer text-center transition-all ${
                              active ? accentBorder + " border" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <div className="text-2xl mb-1">{s.emoji}</div>
                            <p className={`text-xs font-black ${active ? `text-[${accentColor}]` : "text-gray-700"}`}>
                              {s.label}
                            </p>
                            <p className="text-[9px] font-semibold text-gray-400">{s.sub}</p>
                            {active && (
                              <div className="mt-1.5 flex justify-center">
                                <Check size={12} style={{ color: accentColor }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ══════════════ DELIVERY SPECIFIC ══════════════ */}
              {role === "DELIVERY" && (
                <>
                  {/* Vehicle Type */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-2">Vehicle Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "BIKE", label: "Bike", emoji: "🏍️" },
                        { id: "AUTO", label: "Auto Rickshaw", emoji: "🛺" },
                        { id: "TEMPO", label: "Tempo", emoji: "🚐" },
                        { id: "MINI_TRUCK", label: "Mini Truck", emoji: "🚚" },
                      ].map(v => {
                        const active = vehicleType === v.id;
                        return (
                          <div
                            key={v.id}
                            onClick={() => setVehicleType(v.id)}
                            className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center gap-2 ${
                              active ? "border-[#E65100] bg-orange-50/60" : "border-gray-200 bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-xl">{v.emoji}</span>
                            <span className={`text-xs font-bold ${active ? "text-[#E65100]" : "text-gray-600"}`}>
                              {v.label}
                            </span>
                            {active && (
                              <Check size={13} className="text-[#E65100] ml-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Driving Licence ID */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-1.5">
                      Driving Licence Number
                    </label>
                    <input
                      required type="text" placeholder="e.g. RJ14-20120042547"
                      value={licenceId} onChange={e => setLicenceId(e.target.value)}
                      className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing} uppercase tracking-wider`}
                    />
                  </div>

                  {/* Licence Photo */}
                  <div>
                    <label className="text-xs font-bold text-[#424242] block mb-2">
                      Licence Photo
                    </label>
                    <input
                      ref={licencePhotoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLicencePhotoChange}
                    />
                    {licencePreview ? (
                      <div className="relative group rounded-xl overflow-hidden border-2 border-[#E65100] w-full h-40">
                        <img src={licencePreview} alt="Licence" className="w-full h-full object-cover" />
                        <div
                          onClick={() => licencePhotoRef.current?.click()}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                          <p className="text-white text-xs font-bold flex items-center gap-2">
                            <Camera size={16} /> Change Photo
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => licencePhotoRef.current?.click()}
                        className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#E65100] hover:bg-orange-50/30 transition-all group"
                      >
                        <Upload className="w-8 h-8 text-gray-300 group-hover:text-[#E65100] transition-colors mb-2" />
                        <p className="text-xs font-bold text-gray-400 group-hover:text-[#E65100] transition-colors">
                          Click to upload licence photo
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG up to 5MB</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Shared: Location + Aadhaar ─── */}
              <LocationSelector
                value={locationData}
                onChange={setLocationData}
                showVillage={true}
                showPincode={true}
                required={true}
                label="Address / Location"
              />
              <div>
                <label className="text-xs font-bold text-[#424242] block mb-1.5">Aadhaar (Last 4)</label>
                <input
                  required type="text" maxLength={4} placeholder="e.g. 9876"
                  value={aadhaar} onChange={e => setAadhaar(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 transition-all shadow-md ${accentBg} ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Submit Application <ChevronRight size={18} /></>
                  )}
                </button>
                <p className="text-[10px] font-semibold text-center text-gray-400 mt-3">
                  By applying, you agree to CropLine&apos;s Partner Terms &amp; Conditions.
                </p>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
