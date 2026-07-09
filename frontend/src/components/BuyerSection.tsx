"use client";

import { motion } from "framer-motion";
import { CheckCircle, ShieldCheck, Package, Star } from "lucide-react";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

const benefits = [
  "Quality-verified crops directly from farmers",
  "No middlemen — buy at fair farm prices",
  "Safe payments & on-time doorstep delivery",
  "Best deals on bulk orders",
];

const cropCards = [
  { name: "Tomato", price: "₹22/kg", emoji: "🍅" },
  { name: "Potato", price: "₹18/kg", emoji: "🥔" },
  { name: "Onion", price: "₹20/kg", emoji: "🧅" },
];

const featureIcons = [
  { icon: ShieldCheck, label: "Secure Payment" },
  { icon: Package, label: "Live Tracking" },
  { icon: Star, label: "Fast Delivery" },
];

export default function BuyerSection() {
  const { user } = useAuth();
  const router = useRouter();

  const handleBrowseCrops = () => {
    if (user) {
      router.push("/dashboard/buyer");
    } else {
      router.push("/?login=true");
    }
  };

  return (
    <section
      id="buyers"
      className="relative w-full min-h-screen flex items-center bg-[#F9FAF7] overflow-hidden"
    >
      {/* Decorative blob */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#E8F5E9] rounded-full opacity-40 blur-[100px] -translate-y-1/2 translate-x-1/3" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-20 md:py-28">

        {/* Section Label */}
        <div className="inline-flex items-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-full px-4 py-1.5 mb-10">
          <span className="text-lg">🛒</span>
          <span className="text-[#2E7D32] font-semibold text-sm">For Buyers</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-center">

          {/* Left: Text Content */}
          <div className="w-full lg:w-1/2">
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold text-[#212121] leading-[1.15] mb-3 font-[family-name:var(--font-poppins)]">
              Taaza. Sasta.
            </h2>
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold leading-[1.15] mb-8 font-[family-name:var(--font-poppins)]">
              Seedha <span className="text-[#2E7D32]">Kisan se.</span>
            </h2>

            <p className="text-[#757575] text-base sm:text-lg mb-10 leading-relaxed max-w-lg">
              Best quality crops, fair prices and doorstep delivery — everything in one place.
            </p>

            <ul className="space-y-4 mb-10">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#2E7D32] flex-shrink-0 mt-0.5" fill="#E8F5E9" />
                  <span className="text-[#424242] font-medium leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3 mb-10">
              {featureIcons.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-[#A5D6A7] rounded-full px-4 py-2 shadow-sm">
                  <f.icon className="w-4 h-4 text-[#2E7D32]" />
                  <span className="text-sm font-semibold text-[#424242]">{f.label}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={handleBrowseCrops}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-4 rounded-full font-bold text-base shadow-lg transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 8px 24px rgba(27,94,32,0.3)" }}
            >
              Browse Crops →
            </button>
          </div>

          {/* Right: Buyer Character + Cards */}
          <div className="w-full lg:w-1/2 relative flex justify-center items-center">
            {/* 3D Image Container */}
            <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] lg:w-[420px] lg:h-[420px] image-3d">
              <Image
                src="/buyer.png"
                alt="Buyer browsing fresh crops on CropLine"
                fill
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 360px, 420px"
                className="object-cover"
                priority
              />
            </div>

            {/* Popular Crops Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -top-4 -right-2 sm:right-2 lg:-right-6 bg-white rounded-2xl p-4 shadow-xl border border-green-100 w-44 sm:w-48"
            >
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider mb-3">Popular Crops</p>
              <div className="grid grid-cols-3 gap-2">
                {cropCards.map((c, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl mb-1">{c.emoji}</div>
                    <p className="text-[9px] font-semibold text-[#424242]">{c.name}</p>
                    <p className="text-[9px] text-[#2E7D32] font-bold">{c.price}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Order Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-4 -left-2 sm:left-2 lg:-left-8 bg-white rounded-2xl p-4 shadow-xl border border-green-100 w-44 sm:w-48"
            >
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider mb-1">Order Status</p>
              <p className="text-xs font-bold text-[#212121] mb-2">Your order is on the way!</p>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]" />
                <div className="flex-1 h-0.5 bg-[#A5D6A7] rounded" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#66BB6A]" />
                <div className="flex-1 h-0.5 bg-green-100 rounded" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-100 border border-green-200" />
              </div>
              <p className="text-[10px] text-[#66BB6A] font-semibold mt-2">✓ Delivered — Fresh & on time!</p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
