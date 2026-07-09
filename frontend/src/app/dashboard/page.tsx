"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else {
        const activeRole = user.activeRole.toLowerCase();
        router.push(`/dashboard/${activeRole}`);
      }
    }
  }, [user, loading, router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F9FAF7]">
      <Loader2 className="w-10 h-10 animate-spin text-[#1B5E20] mb-4" />
      <p className="text-[#424242] font-semibold text-lg">Loading your CropLine space...</p>
    </div>
  );
}
