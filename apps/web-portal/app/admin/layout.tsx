import { requireAdmin } from '@/lib/auth/admin';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // Blocks non-admins

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin />
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  );
}
