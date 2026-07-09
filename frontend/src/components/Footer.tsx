"use client";

import { Leaf } from "lucide-react";

const footerLinks = {
  "For Buyers": ["Browse Crops", "My Orders", "Track Order", "Help Center"],
  "For Farmers": ["Sell on CropLine", "My Listings", "Farmer Support", "Resources"],
  "For Delivery Partners": ["Join as Partner", "My Deliveries", "Earnings", "Partner Support"],
  Company: ["About Us", "How It Works", "Blog", "Contact Us"],
};

export default function Footer() {
  return (
    <footer className="bg-[#1B5E20] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-[#FFC107] rounded-xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-[#1B5E20]" fill="#1B5E20" />
              </div>
              <span className="text-xl font-bold font-[family-name:var(--font-poppins)]">
                Crop<span className="text-[#FFC107]">Line</span>
              </span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              The farmer&apos;s companion, India&apos;s future.
            </p>
            <div className="flex gap-3">
              {["📸", "🐦", "📘", "▶️"].map((icon, i) => (
                <button
                  key={i}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-sm transition-colors"
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-bold text-sm mb-4 text-white/90">{title}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/55 hover:text-[#FFC107] text-sm transition-colors duration-200">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">© 2024 CropLine. All rights reserved.</p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms & Conditions"].map((l) => (
              <a key={l} href="#" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
