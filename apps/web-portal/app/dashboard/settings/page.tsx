import { verifySession } from '@/lib/auth/dal';
import { db, users } from '@slack-speak/database';
import { and, eq } from 'drizzle-orm';
import { ProfileSection } from './profile-section';
import { DataPrivacySection } from './data-privacy-section';
import { HelpLink } from '@/components/help/help-link';

async function getUserEmail(workspaceId: string, slackUserId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.workspaceId, workspaceId),
        eq(users.slackUserId, slackUserId)
      )
    )
    .limit(1);
  return user?.email || null;
}

export default async function SettingsPage() {
  const session = await verifySession();
  const email = session.email || await getUserEmail(session.workspaceId, session.userId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <HelpLink href="/docs/admin/compliance" label="Data privacy documentation" />
        </div>
        <p className="text-gray-600 mt-1">
          Manage your account preferences and data
        </p>
      </div>

      {/* Profile Section */}
      <ProfileSection
        currentEmail={email}
        slackUserId={session.userId}
      />

      {/* Data & Privacy Section */}
      <DataPrivacySection />
    </div>
  );
}
