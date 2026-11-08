import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
