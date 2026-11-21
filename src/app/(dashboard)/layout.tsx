import { BottomNav } from "@/components/layout/bottom-nav";
import { RoleProvider } from "@/components/layout/role-context";
import { getCurrentRole } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentRole();

  return (
    <RoleProvider role={role}>
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</div>
      <BottomNav />
    </div>
    </RoleProvider>
  );
}
