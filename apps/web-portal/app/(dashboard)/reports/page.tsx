import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportSettingsForm } from '@/components/forms/report-settings-form';
import { getReportSettings, getGoogleIntegration, getWorkflowConfig } from '@/lib/db/queries';
import { GoogleConnectionCard } from '@/components/dashboard/google-connection-card';
import { WorkflowConfigForm } from '@/components/workflow-config-form';
import { SuccessToast } from '@/components/dashboard/success-toast';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; error?: string }>;
}) {
  const [settings, googleIntegration, workflowChannels] = await Promise.all([
    getReportSettings(),
    getGoogleIntegration(),
    getWorkflowConfig(),
  ]);
  const params = await searchParams;

  const isConfigured = !!googleIntegration?.spreadsheetId;

  return (
    <div className="p-8 space-y-6">
      {params.google_connected === 'true' && (
        <SuccessToast message="Google account connected successfully" />
      )}
      {params.error === 'google_auth_failed' && (
        <SuccessToast message="Failed to connect Google account" variant="error" />
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Weekly Reports</h1>
        <p className="text-gray-600 mt-1">
          Configure automated weekly team report generation from workflow submissions.
        </p>
      </div>

      {/* Step 1: Google Connection */}
      <GoogleConnectionCard
        isConnected={!!googleIntegration}
        connectedEmail={googleIntegration?.scope || null}
        spreadsheetId={googleIntegration?.spreadsheetId || null}
        spreadsheetName={googleIntegration?.spreadsheetName || null}
      />

      {/* Step 2: Workflow Channel Monitoring */}
      <WorkflowConfigForm
        channels={workflowChannels}
        disabled={!isConfigured}
      />

      {/* Step 3: Report Settings */}
      <ReportSettingsForm
        defaultValues={settings ? {
          enabled: settings.enabled ?? false,
          dayOfWeek: settings.dayOfWeek ?? 1,
          timeOfDay: settings.timeOfDay ?? '09:00',
          timezone: settings.timezone ?? 'America/New_York',
          format: (settings.format as 'concise' | 'detailed') ?? 'detailed',
          sections: (settings.sections as ('achievements' | 'focus' | 'blockers' | 'shoutouts')[]) ?? ['achievements', 'focus', 'blockers', 'shoutouts'],
          autoSend: settings.autoSend ?? false,
        } : undefined}
        disabled={!isConfigured}
      />

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How Weekly Reports Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              1
            </div>
            <div>
              <strong className="text-gray-900">Team members submit updates</strong>
              <p>Team members use your Slack workflow form to submit weekly updates (achievements, focus, blockers, shoutouts).</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              2
            </div>
            <div>
              <strong className="text-gray-900">Data captured to Google Sheets</strong>
              <p>Each submission is automatically written to your configured Google Sheet for tracking and aggregation.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              3
            </div>
            <div>
              <strong className="text-gray-900">AI generates board-ready report</strong>
              <p>On your configured schedule (or manually via /generate-report), AI summarizes all submissions into a polished report.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              4
            </div>
            <div>
              <strong className="text-gray-900">Review and share</strong>
              <p>The draft report is sent to your DM for review. Refine it if needed, then copy and share with your board.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
