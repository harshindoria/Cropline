"use client";

import { motion } from "framer-motion";
import { CheckCircle, Plus } from "lucide-react";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

const benefits = [
  "Free crop listing & easy inventory management",
  "Sell directly to buyers at better prices",
  "Secure & timely payments guaranteed",
  "Grow demand for your produce",
];

const listings = [
  { name: "Wheat (Gehu)", detail: "1000 kg available", price: "₹18 / kg", status: "Active" },
  { name: "Corn (Makka)", detail: "500 kg available", price: "₹10 / kg", status: "Active" },
  { name: "Pearl Millet (Bajra)", detail: "800 kg available", price: "₹22 / kg", status: "Active" },
];

export default function FarmerSection() {
  const { user } = useAuth();
  const router = useRouter();

  const handleStartSelling = () => {
    if (user) {
      if (user.roles.includes("FARMER")) {
        router.push("/dashboard/farmer");
      } else {
        alert("You are not onboarded as a Farmer yet. Please apply for the Farmer role from your Buyer Dashboard sidebar!");
        router.push("/dashboard");
      }
    } else {
      router.push("/?login=true");
    }
  };

  return (
    <section
      id="farmers"
      className="relative w-full min-h-screen flex items-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #F1F8E9 0%, #E8F5E9 60%, #C8E6C9 100%)" }}
    >
      {/* Decorative blob */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#A5D6A7] rounded-full opacity-20 blur-[100px] translate-y-1/2 -translate-x-1/3" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-20 md:py-28">

        {/* Section Label */}
        <div className="inline-flex items-center gap-2 bg-white border border-[#A5D6A7] rounded-full px-4 py-1.5 mb-10">
          <span className="text-lg">🌾</span>
          <span className="text-[#2E7D32] font-semibold text-sm">For Farmers</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-center">

          {/* Left: Farmer Image */}
          <div className="w-full lg:w-1/2 relative flex justify-center items-center order-2 lg:order-1">
            {/* 3D Image Container */}
            <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] lg:w-[420px] lg:h-[420px] image-3d">
              <Image
                src="/farmer.png"
                alt="Farmer managing crops on CropLine"
                fill
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 360px, 420px"
                className="object-cover"
              />
            </div>

            {/* Your Listings Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -top-4 -right-2 sm:right-2 lg:-right-6 bg-white rounded-2xl p-4 shadow-xl border border-green-100 w-52 sm:w-56"
            >
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider mb-3">Your Listings</p>
              <div className="space-y-2.5">
                {listings.map((l, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-[#212121]">{l.name}</p>
                      <p className="text-[10px] text-[#757575]">{l.detail}</p>
                      <p className="text-[10px] text-[#2E7D32] font-bold">{l.price}</p>
                    </div>
                    <span className="text-[9px] bg-[#E8F5E9] text-[#2E7D32] font-semibold px-2 py-0.5 rounded-full">
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Earnings Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-4 -left-2 sm:left-2 lg:-left-8 bg-[#FFC107] text-[#1B5E20] rounded-2xl px-4 py-2.5 shadow-xl"
            >
              <p className="text-xs font-bold">📈 3x Better Earnings</p>
              <p className="text-[10px] font-medium opacity-80">vs traditional market</p>
            </motion.div>
          </div>

          {/* Right: Text Content */}
          <div className="w-full lg:w-1/2 order-1 lg:order-2">
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold text-[#212121] leading-[1.15] mb-3 font-[family-name:var(--font-poppins)]">
              Becho Apni Fasal,
            </h2>
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold leading-[1.15] mb-8 font-[family-name:var(--font-poppins)]">
              Pao <span className="text-[#FFC107]">Behtar Daam.</span>
            </h2>

            <p className="text-[#757575] text-base sm:text-lg mb-10 leading-relaxed max-w-lg">
              Reach millions of buyers directly and earn the true value of your hard work.
            </p>

            <ul className="space-y-4 mb-10">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#FFC107] flex-shrink-0 mt-0.5" fill="#FFF9C4" />
                  <span className="text-[#424242] font-medium leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={handleStartSelling}
              className="bg-[#FFC107] text-[#1B5E20] px-8 py-4 rounded-full font-bold text-base shadow-lg hover:bg-[#FFD54F] transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 8px 24px rgba(255,193,7,0.4)" }}
            >
              Start Selling →
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
