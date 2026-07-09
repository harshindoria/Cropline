"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Leaf, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LoginModal from "./LoginModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "For Buyers", href: "#buyers" },
  { label: "For Farmers", href: "#farmers" },
  { label: "For Delivery Partners", href: "#delivery" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About Us", href: "#about" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAuthAction = () => {
    if (user) {
      router.push("/dashboard");
    } else {
      setLoginOpen(true);
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-green-100"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div 
              whileHover={{ scale: 1.03 }} 
              onClick={() => router.push("/")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-9 h-9 bg-[#1B5E20] rounded-xl flex items-center justify-center shadow-md">
                <Leaf className="w-5 h-5 text-[#FFC107]" fill="#FFC107" />
              </div>
              <span className={`text-xl font-bold font-[family-name:var(--font-poppins)] ${isScrolled ? "text-[#1B5E20]" : "text-white"}`}>
                Crop<span className="text-[#FFC107]">Line</span>
              </span>
            </motion.div>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`text-sm font-semibold transition-colors duration-200 hover:text-[#66BB6A] ${isScrolled ? "text-[#424242]" : "text-white/90"}`}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Login / Dashboard Button */}
            <div className="hidden lg:flex items-center gap-3">

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAuthAction}
                className={`px-6 py-2 rounded-full text-sm font-bold border-2 transition-all duration-200 shadow-sm flex items-center gap-2 ${
                  isScrolled
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
                    : "border-white bg-white text-[#1B5E20] hover:bg-green-50"
                }`}
              >
                {user ? (
                  <>Go to Dashboard</>
                ) : (
                  <>Login</>
                )}
              </motion.button>
            </div>

            {/* Mobile toggle */}
            <button
              className={`lg:hidden p-2 rounded-lg ${isScrolled ? "text-[#1B5E20]" : "text-white"}`}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 z-40 bg-white flex flex-col pt-20 px-6 gap-4 lg:hidden"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="text-lg font-bold text-[#1B5E20] border-b border-green-100 pb-3"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </motion.a>
            ))}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => { setMobileOpen(false); handleAuthAction(); }}
              className="mt-4 py-3.5 rounded-full bg-[#1B5E20] text-white font-bold shadow-md flex items-center justify-center gap-2"
            >
              {user ? "Go to Dashboard" : "Login"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
