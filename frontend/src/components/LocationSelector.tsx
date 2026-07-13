"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronDown, Check, Search } from "lucide-react";
import { INDIA_STATES, getDistrictsForState, getStateNames } from "@/lib/india-locations";

export interface LocationValue {
  state: string;
  district: string;
  village?: string;
  pincode?: string;
}

interface LocationSelectorProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  showVillage?: boolean;
  showPincode?: boolean;
  required?: boolean;
  label?: string;
  compact?: boolean; // Compact mode for modals
}

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  id,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative" id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-white border rounded-xl text-sm transition-all ${
          open ? "border-[#1B5E20] ring-1 ring-[#1B5E20]" : "border-gray-200 hover:border-gray-300"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
      >
        <span className={`font-semibold truncate ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ml-1 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-52 flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-xs font-medium outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
          {/* Options */}
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center font-medium">No results found</div>
            ) : (
              filtered.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); setSearch(""); }}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm hover:bg-[#E8F5E9] transition-colors ${
                    value === option ? "bg-[#E8F5E9] text-[#1B5E20] font-bold" : "text-gray-700 font-medium"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {value === option && <Check className="w-3.5 h-3.5 text-[#1B5E20] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocationSelector({
  value,
  onChange,
  showVillage = true,
  showPincode = true,
  required = false,
  label = "Address / Location",
  compact = false,
}: LocationSelectorProps) {
  const stateNames = getStateNames();
  const districts = value.state ? getDistrictsForState(value.state) : [];

  const handleStateChange = (state: string) => {
    // Reset district when state changes — prevents stale district from another state
    onChange({ ...value, state, district: "" });
  };

  const handleDistrictChange = (district: string) => {
    onChange({ ...value, district });
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#2E7D32] shrink-0" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
      )}

      <div className={`border-2 border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2.5 focus-within:border-[#1B5E20] transition-colors`}>
        {/* State & District Row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              State {required && <span className="text-red-500">*</span>}
            </label>
            <SearchableDropdown
              id="location-state-selector"
              options={stateNames}
              value={value.state}
              onChange={handleStateChange}
              placeholder="Select State"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              District {required && <span className="text-red-500">*</span>}
            </label>
            <SearchableDropdown
              id="location-district-selector"
              options={districts}
              value={value.district}
              onChange={handleDistrictChange}
              placeholder={value.state ? "Select District" : "Select state first"}
              disabled={!value.state}
            />
          </div>
        </div>

        {/* Village & Pincode Row */}
        {(showVillage || showPincode) && (
          <div className={`grid gap-2 ${showVillage && showPincode ? "grid-cols-2" : "grid-cols-1"}`}>
            {showVillage && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Village / Area / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kalyanpura"
                  value={value.village || ""}
                  onChange={e => onChange({ ...value, village: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-all"
                />
              </div>
            )}
            {showPincode && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Pincode {required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 302020"
                  value={value.pincode || ""}
                  onChange={e => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "") })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-all"
                />
              </div>
            )}
          </div>
        )}

        {/* Live preview */}
        {(value.state || value.district) && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <MapPin className="w-3 h-3 text-[#2E7D32] shrink-0" />
            <span className="text-[11px] font-bold text-[#2E7D32] truncate">
              {[value.village, value.district, value.state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact inline version for admin filter bars
export function StateDistrictFilter({
  selectedState,
  selectedDistrict,
  onStateChange,
  onDistrictChange,
  className = "",
}: {
  selectedState: string;
  selectedDistrict: string;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  className?: string;
}) {
  const stateNames = ["All States", ...getStateNames()];
  const districts = selectedState && selectedState !== "All States"
    ? ["All Districts", ...getDistrictsForState(selectedState)]
    : ["All Districts"];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <select
          value={selectedState}
          onChange={e => { onStateChange(e.target.value); onDistrictChange("All Districts"); }}
          className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer max-w-[160px]"
        >
          {stateNames.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="relative">
        <select
          value={selectedDistrict}
          onChange={e => onDistrictChange(e.target.value)}
          disabled={!selectedState || selectedState === "All States"}
          className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-[#1B5E20] bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[160px]"
        >
          {districts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}
