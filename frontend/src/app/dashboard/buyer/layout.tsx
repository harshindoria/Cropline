import BuyerSidebar from "@/components/BuyerSidebar";

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFBFA] flex font-[family-name:var(--font-poppins)] text-[#212121]">
      <BuyerSidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
