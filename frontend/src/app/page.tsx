"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import BuyerSection from "@/components/BuyerSection";
import FarmerSection from "@/components/FarmerSection";
import DeliverySection from "@/components/DeliverySection";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";
import LoginModal from "@/components/LoginModal";

function LandingPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("login") === "true") {
      if (user) {
        // Already logged in, clear query param and go to dashboard
        router.push("/dashboard");
      } else {
        setLoginOpen(true);
      }
    }
  }, [searchParams, user, router]);

  return (
    <main className="flex flex-col min-h-screen">
      <Navbar />
      <HeroSection />
      <BuyerSection />
      <FarmerSection />
      <DeliverySection />
      <HowItWorks />
      <Footer />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  );
}
