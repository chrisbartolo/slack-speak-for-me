import Link from 'next/link';
import { verifySession } from '@/lib/auth/dal';
import { isAdmin } from '@/lib/auth/admin';
import { Sidebar } from '@/components/dashboard/sidebar';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSubscriptionMessage } from '@/lib/billing/seat-enforcement';

const { workspaces, organizations } = schema;

function SubscriptionBanner({ type, message }: { type: 'info' | 'warning' | 'error'; message: string }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    error: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`border rounded-lg px-4 py-2 text-sm ${styles[type]} mb-4`}>
      {message}
      {type === 'error' && (
        <Link href="/admin/billing" className="ml-2 underline">Upgrade now</Link>
      )}
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify authentication - will redirect to /login if not authenticated
  const session = await verifySession();

  // Check if user is admin for sidebar display
  const adminStatus = await isAdmin();

  // Get workspace with organization for subscription status
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, session.workspaceId),
  });

  let subscriptionBanner: { type: 'info' | 'warning' | 'error'; message: string } | null = null;

  if (workspace?.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, workspace.organizationId),
    });

    if (org) {
      subscriptionBanner = getSubscriptionMessage(
        org.subscriptionStatus,
        org.trialEndsAt
      );
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isAdmin={adminStatus} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {subscriptionBanner && (
            <SubscriptionBanner
              type={subscriptionBanner.type}
              message={subscriptionBanner.message}
            />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
