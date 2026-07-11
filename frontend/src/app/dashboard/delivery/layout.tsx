import DeliverySidebar from "@/components/DeliverySidebar";

export default function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex font-[family-name:var(--font-poppins)]">
      <DeliverySidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
