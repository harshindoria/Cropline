"use client";

import Link from "next/link";
import { Leaf } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { user } = useAuth();
  // Logged-in users go to their dashboard; visitors get the login box first.
  const appLink = user ? "/dashboard" : "/?login=true";

  const footerLinks: Record<string, { label: string; href: string }[]> = {
    "For Buyers": [
      { label: "Why Buy on CropLine", href: "#buyers" },
      { label: "Browse Crops", href: appLink },
      { label: "How It Works", href: "#how-it-works" },
    ],
    "For Farmers": [
      { label: "Why Sell on CropLine", href: "#farmers" },
      { label: "Start Selling", href: appLink },
    ],
    "For Delivery Partners": [
      { label: "Why Deliver with Us", href: "#delivery" },
      { label: "Join as Partner", href: appLink },
    ],
  };

  return (
    <footer className="bg-[#1B5E20] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 mb-4 lg:mb-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-[#FFC107] rounded-xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-[#1B5E20]" fill="#1B5E20" />
              </div>
              <span className="text-xl font-bold font-[family-name:var(--font-poppins)]">
                Crop<span className="text-[#FFC107]">Line</span>
              </span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              The farmer&apos;s companion, India&apos;s future.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-bold text-sm mb-4 text-white/90">{title}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/55 hover:text-[#FFC107] text-sm transition-colors duration-200">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex items-center justify-center">
          <p className="text-white/40 text-sm">© {new Date().getFullYear()} CropLine. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
