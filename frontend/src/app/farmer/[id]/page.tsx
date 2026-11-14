"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Old address for a farmer's profile. The real profile page lives in the buyer
// dashboard, so send anyone with an old link there.
export default function FarmerProfileRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/buyer/farmer/${params.id}`);
  }, [params.id, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAF7]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B5E20]"></div>
    </div>
  );
}
