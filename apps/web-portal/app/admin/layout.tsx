import { requireAdmin } from '@/lib/auth/admin';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { Sidebar } from '@/components/dashboard/sidebar';
import { ResponsiveSidebar } from '@/components/dashboard/responsive-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // Blocks non-admins
  const superAdminStatus = await isSuperAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar isAdmin isSuperAdmin={superAdminStatus} />
      </div>

      {/* Mobile Header with Drawer Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b bg-background px-4 py-3 flex items-center gap-3">
        <ResponsiveSidebar isAdmin isSuperAdmin={superAdminStatus} />
        <span className="font-semibold">Speak For Me</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
