'use client';
import { Leaf, Home, ShoppingBag, Truck, Star, User, HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import api from "@/lib/axios";

export default function DeliverySidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if(user && 'isOnline' in user) {
      setIsOnline(user.isOnline as boolean);
    }
  }, [user]);

  const toggleOnline = async () => {
    try {
      const newStatus = !isOnline;
      setIsOnline(newStatus);
      await api.patch('/users/online-status', { isOnline: newStatus });
    } catch (error) {
      console.error(error);
      setIsOnline(!isOnline); // revert on error
    }
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard/delivery", icon: Home },
    { name: "Available Deliveries", href: "/dashboard/delivery/available", icon: ShoppingBag },
    { name: "Active Deliveries", href: "/dashboard/delivery/active", icon: Truck },
    { name: "Ratings & Reviews", href: "#", icon: Star },
    { name: "Profile", href: "#", icon: User },
    { name: "Help", href: "#", icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 h-screen overflow-y-auto">
      <div>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-[#1B5E20]" />
            </div>
            <span className="text-xl font-black text-[#1B5E20]">
              CROP<span className="text-[#FFC107]">LINE</span>
            </span>
          </div>
          <p className="text-[11px] font-bold text-gray-400 pl-10 uppercase tracking-wider">Delivery Partner</p>
        </div>

        <nav className="px-4 space-y-1.5 mt-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${isActive ? 'bg-[#E8F5E9] text-[#1B5E20]' : 'text-gray-500 hover:text-[#1B5E20] hover:bg-gray-50'}`}
              >
                <Icon size={18} /> {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 mb-4">
        <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`} />
              <span className="text-xs font-bold text-gray-600">{isOnline ? 'You are online' : 'You are offline'}</span>
            </div>
            <button 
              onClick={toggleOnline}
              className={`w-10 h-5 rounded-full relative transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isOnline ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium leading-tight">
            {isOnline ? 'You will receive new delivery requests nearby.' : 'Go online to start receiving delivery requests.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
