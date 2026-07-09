"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { UserPlus, Search, ShoppingCart, Truck } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Register",
    desc: "Sign in with your phone or Google account. Choose your role — Buyer, Farmer, or Delivery Partner.",
    color: "#1B5E20",
    bg: "#E8F5E9",
    step: "01",
  },
  {
    icon: Search,
    title: "Browse",
    desc: "Explore fresh crops listed by farmers nearby. Filter by price, category, and distance.",
    color: "#FFC107",
    bg: "#FFF9C4",
    step: "02",
  },
  {
    icon: ShoppingCart,
    title: "Place Order",
    desc: "Select your quantity and pay securely via UPI, online, or Cash on Delivery.",
    color: "#2E7D32",
    bg: "#E8F5E9",
    step: "03",
  },
  {
    icon: Truck,
    title: "Get it Delivered",
    desc: "A verified delivery partner picks up and delivers your order straight from the farm.",
    color: "#FFC107",
    bg: "#FFF9C4",
    step: "04",
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      className="w-full py-20 lg:py-28"
      style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #388E3C 100%)" }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center mb-16">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 mb-4"
          >
            <span className="text-white/80 text-sm font-medium">Simple Process</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl lg:text-5xl font-extrabold text-white mb-6 font-[family-name:var(--font-poppins)]"
          >
            Kaise Kaam Karta Hai?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/70 text-lg max-w-xl mx-auto"
          >
            Get fresh farm produce delivered to your home in just 4 easy steps.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
              className="relative bg-white rounded-3xl p-6 card-hover"
            >
              <div
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                style={{ background: s.color }}
              >
                {s.step}
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: s.bg }}
              >
                <s.icon className="w-7 h-7" style={{ color: s.color }} />
              </div>
              <h3 className="text-lg font-bold text-[#212121] mb-3 font-[family-name:var(--font-poppins)]">
                {s.title}
              </h3>
              <p className="text-[#757575] text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
