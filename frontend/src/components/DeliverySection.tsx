"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { CheckCircle, MapPin, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

const benefits = [
  "Nearby deliveries — less travel, more trips",
  "Earn well on every delivery",
  "Weekly payouts & performance bonuses",
  "24x7 delivery partner support",
];

const earningsData = [30, 55, 40, 80, 60, 95, 70];

export default function DeliverySection() {
  const { user } = useAuth();
  const router = useRouter();

  const handleJoinPartner = () => {
    if (user) {
      if (user.roles.includes("DELIVERY")) {
        router.push("/dashboard/delivery");
      } else {
        alert("You are not onboarded as a Delivery Partner yet. Please apply for the Delivery role from your Buyer Dashboard sidebar!");
        router.push("/dashboard");
      }
    } else {
      router.push("/?login=true");
    }
  };

  return (
    <section
      id="delivery"
      className="relative w-full min-h-screen flex items-center bg-[#F9FAF7] overflow-hidden"
    >
      {/* Decorative blob */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#E8F5E9] rounded-full opacity-50 blur-[100px] -translate-y-1/2 translate-x-1/3" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-20 md:py-28">

        {/* Section Label */}
        <div className="inline-flex items-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-full px-4 py-1.5 mb-10">
          <span className="text-lg">🛵</span>
          <span className="text-[#2E7D32] font-semibold text-sm">For Delivery Partners</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-center">

          {/* Left: Text Content */}
          <div className="w-full lg:w-1/2">
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold text-[#212121] leading-[1.15] mb-3 font-[family-name:var(--font-poppins)]">
              Zyada Deliveries,
            </h2>
            <h2 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold leading-[1.15] mb-8 font-[family-name:var(--font-poppins)]">
              <span className="text-[#2E7D32]">Zyada Kamai.</span>
            </h2>

            <p className="text-[#757575] text-base sm:text-lg mb-10 leading-relaxed max-w-lg">
              Flexible hours, the best earnings in agri-logistics, and a growing network — join CropLine today.
            </p>

            <ul className="space-y-4 mb-10">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#1B5E20] flex-shrink-0 mt-0.5" fill="#E8F5E9" />
                  <span className="text-[#424242] font-medium leading-snug">{b}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={handleJoinPartner}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-4 rounded-full font-bold text-base shadow-lg transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 8px 24px rgba(27,94,32,0.3)" }}
            >
              Join as Partner →
            </button>
          </div>

          {/* Right: Delivery Character + Cards */}
          <div className="w-full lg:w-1/2 relative flex justify-center items-center">
            {/* 3D Image Container */}
            <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] lg:w-[420px] lg:h-[420px] image-3d">
              <Image
                src="/delivery.png"
                alt="CropLine delivery partner on scooter"
                fill
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 360px, 420px"
                className="object-cover"
              />
            </div>

            {/* Earnings Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute -top-4 -right-2 sm:right-2 lg:-right-6 bg-white rounded-2xl p-4 shadow-xl border border-green-100 w-48 sm:w-52"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Today&apos;s Earnings</p>
                <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
              </div>
              <p className="text-2xl font-extrabold text-[#1B5E20] mb-0.5">₹680</p>
              <p className="text-[11px] text-[#757575] mb-3">4 Deliveries Completed</p>
              <div className="flex items-end gap-1 h-10">
                {earningsData.map((h, i) => (
                  <div key={i} style={{ height: `${h}%` }} className="flex-1 rounded-sm bg-[#66BB6A]" />
                ))}
              </div>
            </motion.div>

            {/* Next Delivery Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-4 -left-2 sm:left-2 lg:-left-8 bg-white rounded-2xl p-4 shadow-xl border border-green-100 w-44 sm:w-48"
            >
              <p className="text-[10px] font-bold text-[#757575] uppercase tracking-wider mb-2">Next Delivery</p>
              <p className="text-sm font-bold text-[#212121]">Green Valley Farm</p>
              <div className="flex items-center gap-1 mt-1.5">
                <MapPin className="w-3 h-3 text-[#2E7D32]" />
                <p className="text-xs text-[#757575]">2.4 km away</p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
