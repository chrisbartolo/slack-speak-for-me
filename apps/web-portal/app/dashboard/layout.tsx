import Link from 'next/link';
import { verifySession } from '@/lib/auth/dal';
import { isAdmin } from '@/lib/auth/admin';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { Sidebar } from '@/components/dashboard/sidebar';
import { ResponsiveSidebar } from '@/components/dashboard/responsive-sidebar';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSubscriptionMessage } from '@/lib/billing/seat-enforcement';
import { checkUserAccess, getIndividualSubscription } from '@/lib/billing/access-check';

const { workspaces, organizations } = schema;

function SubscriptionBanner({
  type,
  message,
  upgradeLink,
}: {
  type: 'info' | 'warning' | 'error';
  message: string;
  upgradeLink?: string;
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    error: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`border rounded-lg px-4 py-2 text-sm ${styles[type]} mb-4`}>
      {message}
      {type === 'error' && upgradeLink && (
        <Link href={upgradeLink} className="ml-2 underline">Upgrade now</Link>
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
  const superAdminStatus = await isSuperAdmin();

  // Check user access using the unified access check
  const access = await checkUserAccess(session.email, session.workspaceId);

  // Get workspace with organization for subscription status (for org-based trial info)
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, session.workspaceId),
  });

  // Get individual subscription for trial info if access is individual
  const individualSub = session.email
    ? await getIndividualSubscription(session.email)
    : null;

  let subscriptionBanner: { type: 'info' | 'warning' | 'error'; message: string; upgradeLink?: string } | null = null;

  if (access.hasAccess) {
    // User has access - check if we need to show trial/status messages
    if (access.source === 'individual') {
      // Individual subscription - use trial end from userSubscriptions
      subscriptionBanner = getSubscriptionMessage(
        access.status,
        individualSub?.trialEndsAt ?? null
      );
      if (subscriptionBanner?.type === 'error') {
        subscriptionBanner.upgradeLink = '/dashboard/billing';
      }
    } else {
      // Organization subscription - use org trial end
      if (workspace?.organizationId) {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, workspace.organizationId),
        });

        if (org) {
          subscriptionBanner = getSubscriptionMessage(
            org.subscriptionStatus,
            org.trialEndsAt ?? null
          );
          if (subscriptionBanner?.type === 'error') {
            subscriptionBanner.upgradeLink = '/admin/billing';
          }
        }
      }
    }
  } else {
    // User doesn't have access - show appropriate error
    const upgradeLink = adminStatus ? '/admin/billing' : '/dashboard/billing';
    subscriptionBanner = {
      type: 'error',
      message: access.reason === 'no_subscription'
        ? 'No active subscription. Subscribe to access all features.'
        : access.reason === 'paused'
        ? 'Your subscription is paused. Update payment to resume.'
        : 'Your subscription has been canceled.',
      upgradeLink,
    };
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar isAdmin={adminStatus} isSuperAdmin={superAdminStatus} />
      </div>

      {/* Mobile Header with Drawer Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 border-b bg-background px-4 py-3 flex items-center gap-3">
        <ResponsiveSidebar isAdmin={adminStatus} isSuperAdmin={superAdminStatus} />
        <span className="font-semibold">Speak For Me</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-6">
          {subscriptionBanner && (
            <SubscriptionBanner
              type={subscriptionBanner.type}
              message={subscriptionBanner.message}
              upgradeLink={subscriptionBanner.upgradeLink}
            />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
