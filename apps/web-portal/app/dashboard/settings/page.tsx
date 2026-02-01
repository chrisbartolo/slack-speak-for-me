'use client';

import { useState } from 'react';
import { Download, Shield, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const response = await fetch('/api/gdpr/export');

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();

      // Create and trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'speak-for-me-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export data. Please try again later.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account preferences and data
        </p>
      </div>

      {/* Data & Privacy Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Data & Privacy
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Data */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Export My Data</h3>
              <p className="text-sm text-gray-500 mt-1">
                Download a copy of all your personal data stored by Speak for
                Me. This includes your preferences, activity history,
                integrations, and consent records.
              </p>
              {exportError && (
                <p className="text-sm text-red-600 mt-2">{exportError}</p>
              )}
              {exportSuccess && (
                <p className="text-sm text-green-600 mt-2">
                  Data exported successfully! Check your downloads folder.
                </p>
              )}
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Data
                </>
              )}
            </button>
          </div>

          <hr className="border-gray-200" />

          {/* Privacy Info */}
          <div>
            <h3 className="font-medium text-gray-900">Your Privacy Rights</h3>
            <p className="text-sm text-gray-500 mt-1">
              Under GDPR, you have the right to access, correct, and delete your
              personal data. For data deletion requests or questions about your
              data, please contact your workspace administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="text-sm text-gray-500">
        <p>
          Your exported data will be in JSON format and includes information
          from the following categories:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>User profile and workspace information</li>
          <li>Style preferences and report settings</li>
          <li>Person context notes you have created</li>
          <li>Watched conversations and thread participation</li>
          <li>Suggestion feedback and refinement history</li>
          <li>Integration status (Google Sheets, Workflow configs)</li>
          <li>Consent records</li>
        </ul>
      </div>
    </div>
  );
}
