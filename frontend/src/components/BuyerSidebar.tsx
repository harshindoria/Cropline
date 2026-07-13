'use client';
import { Leaf, LayoutDashboard, Store, BarChart2, Package, Users, User, ChevronDown } from "lucide-react";
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
    { name: "Dashboard", href: "/dashboard/buyer?tab=Dashboard", icon: LayoutDashboard, matchParam: "Dashboard" },
    { name: "Marketplace", href: "/dashboard/buyer?tab=Marketplace", icon: Store, matchParam: "Marketplace" },
    { name: "Analytics", href: "/dashboard/buyer/analytics", icon: BarChart2, matchParam: null },
    { name: "Orders", href: "/dashboard/buyer/orders", icon: Package, matchParam: null },
    { name: "Suppliers", href: "/dashboard/buyer/suppliers", icon: Users, matchParam: null },
    { name: "Profile", href: "/dashboard/buyer/profile", icon: User, matchParam: null },
  ];

  if (!user) return null;

  return (
    <aside className="w-64 bg-[#F2F7F2] border-r border-green-100 flex flex-col justify-between hidden lg:flex shrink-0 h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-10">
          <Leaf className="w-6 h-6 text-[#1B5E20]" />
          <span className="text-xl font-extrabold text-[#1B5E20] uppercase tracking-wide">
            Crop<span className="text-[#FFC107]">Line</span>
          </span>
        </div>

        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-bold">{user.name?.split(" ")[0] || "Buyer"}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.activeRole}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
        </div>

        <nav className="space-y-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            let isActive = false;

            if (item.matchParam) {
              isActive = pathname === "/dashboard/buyer" && (currentTab === item.matchParam || (!currentTab && item.matchParam === "Dashboard"));
            } else {
              isActive = pathname.startsWith(item.href);
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? "bg-white text-[#1B5E20] shadow-sm"
                    : "text-gray-500 hover:bg-white/50 hover:text-[#1B5E20]"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#1B5E20]" : "text-gray-400"} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default function BuyerSidebar() {
  return (
    <Suspense fallback={<div className="w-64 bg-[#F2F7F2] border-r border-green-100 hidden lg:flex shrink-0 h-screen" />}>
      <SidebarContent />
    </Suspense>
  );
}
