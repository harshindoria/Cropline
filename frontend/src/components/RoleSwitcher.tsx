'use client';

import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';

interface RoleSwitcherProps {
  currentRole: 'BUYER' | 'FARMER' | 'DELIVERY' | 'ADMIN';
  onApplyRole?: (role: 'FARMER' | 'DELIVERY') => void;
}

export default function RoleSwitcher({ currentRole, onApplyRole }: RoleSwitcherProps) {
  const { user, logout, switchRole } = useAuth();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  if (!user) return null;

  const handleRoleSwitch = async (role: string) => {
    setShowRoleDropdown(false);
    
    if (!user.roles.includes(role as any)) {
      if (onApplyRole && (role === 'FARMER' || role === 'DELIVERY')) {
        onApplyRole(role);
      }
      return;
    }
    
    // Instead of raw API call, use AuthContext switchRole if possible, or API call
    try {
      const res = await api.post('/users/switch-role', { role });
      if (res.data.success) {
        window.location.href = `/dashboard/${role.toLowerCase()}`;
      }
    } catch (error) {
      console.error("Error switching role:", error);
      alert("Failed to switch role.");
    }
  };

  const roleNameMap: Record<string, string> = {
    BUYER: "Buyer",
    FARMER: "Farmer",
    DELIVERY: "Delivery Partner",
    ADMIN: "Admin"
  };

  return (
    <div className="relative">
      <div 
        onClick={() => setShowRoleDropdown(!showRoleDropdown)}
        className="flex items-center gap-2 cursor-pointer bg-gray-50 p-1.5 pr-4 rounded-full border border-gray-100 hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-[#1B5E20] text-white rounded-full flex items-center justify-center font-bold text-xs">
          {user.name ? user.name[0].toUpperCase() : "U"}
        </div>
        <div>
          <p className="text-xs font-bold leading-none">{user.name?.split(" ")[0] || "User"}</p>
          <p className="text-[10px] text-gray-500 leading-tight">{roleNameMap[currentRole]}</p>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-400 ml-1 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
      </div>

      {showRoleDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2 border-b border-gray-50 mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Switch Role</p>
          </div>
          
          <button 
            onClick={() => currentRole !== 'BUYER' && handleRoleSwitch("BUYER")} 
            className={`w-full text-left px-4 py-2 text-sm ${currentRole === 'BUYER' ? 'font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between' : 'font-semibold text-gray-600 hover:bg-gray-50 transition-colors'}`}
          >
            🛒 Buyer
            {currentRole === 'BUYER' && <div className="w-3 h-3 rounded-full bg-[#1B5E20] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
          </button>

          <button 
            onClick={() => currentRole !== 'FARMER' && handleRoleSwitch("FARMER")} 
            className={`w-full text-left px-4 py-2 text-sm ${currentRole === 'FARMER' ? 'font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between' : 'font-semibold text-gray-600 hover:bg-gray-50 transition-colors'}`}
          >
            🌾 Farmer
            {currentRole === 'FARMER' && <div className="w-3 h-3 rounded-full bg-[#1B5E20] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
          </button>

          <button 
            onClick={() => currentRole !== 'DELIVERY' && handleRoleSwitch("DELIVERY")} 
            className={`w-full text-left px-4 py-2 text-sm ${currentRole === 'DELIVERY' ? 'font-bold text-[#1B5E20] bg-green-50/50 flex items-center justify-between' : 'font-semibold text-gray-600 hover:bg-gray-50 transition-colors'}`}
          >
            🛵 Delivery
            {currentRole === 'DELIVERY' && <div className="w-3 h-3 rounded-full bg-[#1B5E20] flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
          </button>
          
          {user.roles.includes("ADMIN") && (
            <button 
              onClick={() => currentRole !== 'ADMIN' && handleRoleSwitch("ADMIN")} 
              className={`w-full text-left px-4 py-2 text-sm ${currentRole === 'ADMIN' ? 'font-bold text-emerald-700 bg-emerald-50/50 flex items-center justify-between border-t border-gray-50 mt-1 pt-2' : 'font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-gray-50 mt-1 pt-2'}`}
            >
              🛡️ Admin Dashboard
              {currentRole === 'ADMIN' && <div className="w-3 h-3 rounded-full bg-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
            </button>
          )}

          <div className="border-t border-gray-50 mt-2 pt-2">
            <button onClick={logout} className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
