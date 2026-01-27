import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportSettingsForm } from '@/components/forms/report-settings-form';
import { getReportSettings } from '@/lib/db/queries';

export default async function ReportsPage() {
  const settings = await getReportSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Weekly Reports</h1>
        <p className="text-gray-600 mt-1">
          Configure automatic weekly report generation
        </p>
      </div>

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
      />

      <Card>
        <CardHeader>
          <CardTitle>How reports work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              1
            </div>
            <p>
              <strong className="text-gray-900">Team submits updates:</strong>{' '}
              Your direct reports submit weekly updates via Slack workflow form
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              2
            </div>
            <p>
              <strong className="text-gray-900">AI aggregates:</strong>{' '}
              Submissions are automatically collected and summarized
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              3
            </div>
            <p>
              <strong className="text-gray-900">Report generated:</strong>{' '}
              AI creates a board-ready summary with achievements, focus areas, blockers, and shoutouts
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              4
            </div>
            <p>
              <strong className="text-gray-900">Review and share:</strong>{' '}
              Report is sent to you for review. You can refine and copy to share.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
