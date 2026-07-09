"use client";

import { motion } from "framer-motion";
import { Leaf, ChevronDown, ShieldCheck, Sprout, Truck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

const floatingCrops = [
  { emoji: "🌽", top: "18%", right: "28%", cls: "float-1" },
  { emoji: "🍅", top: "35%", right: "12%", cls: "float-2" },
  { emoji: "🌾", top: "10%", right: "40%", cls: "float-3" },
  { emoji: "🧅", top: "55%", right: "20%", cls: "float-2" },
  { emoji: "🌿", top: "48%", right: "35%", cls: "float-1" },
  { emoji: "🥬", top: "72%", right: "25%", cls: "float-3" },
];

const badges = [
  { icon: ShieldCheck, text: "Trusted Platform", color: "text-[#FFC107]" },
  { icon: Sprout, text: "Better Prices", color: "text-[#66BB6A]" },
  { icon: Truck, text: "Fast & Safe Delivery", color: "text-[#A5D6A7]" },
];

export default function HeroSection() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/?login=true");
    }
  };

  return (
    <section
      id="home"
      className="relative w-full h-screen flex items-center overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1B5E20 0%, #2E7D32 35%, #388E3C 65%, #66BB6A 85%, #A5D6A7 100%)",
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 opacity-30">
        <svg viewBox="0 0 1440 120" className="w-full" preserveAspectRatio="none">
          <path d="M0,100 C360,30 720,130 1080,60 C1260,30 1380,90 1440,60 L1440,120 L0,120 Z" fill="#1B5E20" />
        </svg>
      </div>

      {/* Floating Crop Emojis */}
      {floatingCrops.map((c, i) => (
        <div
          key={i}
          className={`absolute text-5xl lg:text-6xl select-none pointer-events-none ${c.cls}`}
          style={{ top: c.top, right: c.right }}
        >
          {c.emoji}
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="max-w-2xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8"
          >
            <Leaf className="w-4 h-4 text-[#FFC107]" />
            <span className="text-white/90 text-sm font-medium">Desh ke Kisan, Desh ka Gaurav</span>
          </motion.div>

          {/* Hindi Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6 font-[family-name:var(--font-poppins)]"
          >
            Khet se
            <br />
            Seedha{" "}
            <span className="text-[#FFC107]" style={{ textShadow: "0 0 30px rgba(255,193,7,0.5)" }}>
              Aap Tak
            </span>
          </motion.h1>

          {/* English Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-white/80 text-lg lg:text-xl mb-10 leading-relaxed max-w-xl"
          >
            CropLine connects farmers, buyers, and delivery partners on one trusted platform — cutting out the middleman.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-wrap gap-4 mb-10"
          >
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGetStarted}
              className="flex items-center gap-2 bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-7 py-3.5 rounded-full font-bold text-base shadow-xl transition-all duration-200 cursor-pointer"
              style={{ boxShadow: "0 8px 30px rgba(27,94,32,0.5)" }}
            >
              <Sprout className="w-5 h-5" />
              {user ? "Go to Dashboard" : "Get Started"}
            </motion.button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white px-7 py-3.5 rounded-full font-bold text-base transition-all duration-200"
            >
              How It Works ▶
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap gap-5"
          >
            {badges.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <b.icon className={`w-4 h-4 ${b.color}`} />
                <span className="text-white/80 text-sm font-medium">{b.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/60"
      >
        <span className="text-xs font-medium">Scroll Down</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}
