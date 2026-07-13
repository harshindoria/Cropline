'use client';
import { Leaf, Home, ShoppingBag, Truck, Star, User, HelpCircle, Settings, Sprout, PlusCircle, IndianRupee } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Suspense } from "react";

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const { user } = useAuth();

  const navLinks = [
    { name: "Dashboard", href: "/dashboard/farmer", icon: Home, matchParam: null },
    { name: "My Crops", href: "/dashboard/farmer?tab=mycrops", icon: Sprout, matchParam: "mycrops" },
    { name: "Add Crop", href: "/dashboard/farmer?tab=addcrop", icon: PlusCircle, matchParam: "addcrop" },
    { name: "Orders", href: "/dashboard/farmer/orders", icon: ShoppingBag, matchParam: null },
    { name: "Earnings", href: "/dashboard/farmer?tab=earnings", icon: IndianRupee, matchParam: "earnings" },
    { name: "Ratings & Reviews", href: "/dashboard/farmer/reviews", icon: Star, matchParam: null },
    { name: "Profile", href: "/dashboard/farmer/profile", icon: User, matchParam: null },
    { name: "Help", href: "/dashboard/farmer?tab=help", icon: HelpCircle, matchParam: "help" },
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
          <p className="text-[11px] font-bold text-gray-400 pl-10 uppercase tracking-wider">Farmer Panel</p>
        </div>

        <nav className="px-4 space-y-1.5 mt-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            
            // Determine active state based on route or query param
            let isStrictActive = false;
            
            if (link.matchParam) {
              isStrictActive = pathname === "/dashboard/farmer" && currentTab === link.matchParam;
            } else if (link.href === '/dashboard/farmer') {
              isStrictActive = pathname === link.href && !currentTab;
            } else {
              isStrictActive = pathname.startsWith(link.href);
            }

            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${isStrictActive ? 'bg-[#E8F5E9] text-[#1B5E20]' : 'text-gray-500 hover:text-[#1B5E20] hover:bg-gray-50'}`}
              >
                <Icon size={18} /> {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default function FarmerSidebar() {
  return (
    <Suspense fallback={<div className="w-64 bg-white border-r border-gray-100 hidden md:flex shrink-0 h-screen" />}>
      <SidebarContent />
    </Suspense>
  );
}
