"use client";

import React, { useState, useRef } from "react";
import { 
  X, Tractor, Truck, CheckCircle2, ChevronRight, Check, 
  Upload, Camera, FileText, AlertCircle
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

// Reusable image upload card
function DocUploadCard({
  label,
  preview,
  onChoose,
  accentColor,
  required = true,
}: {
  label: string;
  preview: string | null;
  onChoose: () => void;
  accentColor: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-[#424242] block mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        <span className="text-gray-400 font-semibold ml-2 text-[10px]">
          Upload front + back in a single photo
        </span>
      </label>
      {preview ? (
        <div
          className="relative group rounded-xl overflow-hidden border-2 w-full h-44 cursor-pointer"
          style={{ borderColor: accentColor }}
          onClick={onChoose}
        >
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-white text-xs font-bold flex items-center gap-2">
              <Camera size={16} /> Change Photo
            </p>
          </div>
        </div>
      ) : (
        <div
          onClick={onChoose}
          className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group"
          style={{ "--hover-color": accentColor } as React.CSSProperties}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = accentColor;
            (e.currentTarget as HTMLDivElement).style.background = `${accentColor}08`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb';
            (e.currentTarget as HTMLDivElement).style.background = '';
          }}
        >
          <Upload className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs font-bold text-gray-400">Click to upload photo</p>
          <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG up to 5MB</p>
        </div>
      )}
    </div>
  );
}

export default function ApplicationModal({ isOpen, onClose, role }: ApplicationModalProps) {
  const { onboardNewRole, completeRegistration, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // File refs
  const aadhaarPhotoRef = useRef<HTMLInputElement>(null);
  const licencePhotoRef = useRef<HTMLInputElement>(null);
  const rcPhotoRef = useRef<HTMLInputElement>(null);

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

  // ─── Document Images (base64) ───────────────────────────────
  const [aadhaarBase64, setAadhaarBase64] = useState<string | null>(null);
  const [licenceBase64, setLicenceBase64] = useState<string | null>(null);
  const [rcBase64, setRcBase64] = useState<string | null>(null);

  // ─── Delivery Specific ─────────────────────────────────────
  const [vehicleType, setVehicleType] = useState("BIKE");
  const [licenceId, setLicenceId] = useState("");

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

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await readFileAsBase64(file);
    setter(base64);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate documents are uploaded
    if (role === "FARMER" && !aadhaarBase64) {
      alert("Please upload your Aadhaar Card photo before submitting.");
      return;
    }
    if (role === "DELIVERY" && (!licenceBase64 || !rcBase64)) {
      alert("Please upload both your Driving License and RC (Vehicle) photos before submitting.");
      return;
    }

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
        // Save document images as base64 in the profile
        ...(role === "FARMER" && aadhaarBase64 ? { aadhaarUrl: aadhaarBase64 } : {}),
        ...(role === "DELIVERY" && licenceBase64 ? { dlUrl: licenceBase64 } : {}),
        ...(role === "DELIVERY" && rcBase64 ? { rcUrl: rcBase64 } : {}),
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
                Your application is under review. Our admin team will verify your documents and notify you once approved.
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

                  {/* Farm Details */}
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
                      Driving Licence Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      required type="text" placeholder="e.g. RJ14-20120042547"
                      value={licenceId} onChange={e => setLicenceId(e.target.value)}
                      className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing} uppercase tracking-wider`}
                    />
                  </div>

                  {/* Driving License Photo */}
                  <input
                    ref={licencePhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFileChange(e, setLicenceBase64)}
                  />
                  <DocUploadCard
                    label="Driving Licence Photo"
                    preview={licenceBase64}
                    onChoose={() => licencePhotoRef.current?.click()}
                    accentColor={accentColor}
                  />

                  {/* RC Photo */}
                  <input
                    ref={rcPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFileChange(e, setRcBase64)}
                  />
                  <DocUploadCard
                    label="Vehicle RC Photo"
                    preview={rcBase64}
                    onChoose={() => rcPhotoRef.current?.click()}
                    accentColor={accentColor}
                  />
                </>
              )}

              {/* ── Shared: Location ─── */}
              <LocationSelector
                value={locationData}
                onChange={setLocationData}
                showVillage={true}
                showPincode={true}
                required={true}
                label="Address / Location"
              />

              {/* ── Shared: Aadhaar ─── */}
              <div>
                <label className="text-xs font-bold text-[#424242] block mb-1.5">Aadhaar (Last 4 Digits)</label>
                <input
                  required type="text" maxLength={4} placeholder="e.g. 9876"
                  value={aadhaar} onChange={e => setAadhaar(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:ring-1 ${accentRing}`}
                />
              </div>

              {/* ── Farmer: Aadhaar Card Photo ─── */}
              {role === "FARMER" && (
                <>
                  <input
                    ref={aadhaarPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFileChange(e, setAadhaarBase64)}
                  />
                  <DocUploadCard
                    label="Aadhaar Card Photo"
                    preview={aadhaarBase64}
                    onChoose={() => aadhaarPhotoRef.current?.click()}
                    accentColor={accentColor}
                  />
                </>
              )}

              {/* Document requirement notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-700">
                  {role === "FARMER"
                    ? "Your Aadhaar Card is required for identity verification. An admin will review and approve your application."
                    : "Both your Driving License and Vehicle RC are required for verification. Upload clear photos showing both front and back sides in one image."}
                </p>
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
