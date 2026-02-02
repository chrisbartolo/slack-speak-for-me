'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Shield, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const CONFIRMATION_TEXT = 'DELETE MY ACCOUNT';

export default function SettingsPage() {
  const router = useRouter();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Delete account state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmationInput === CONFIRMATION_TEXT;

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

  async function handleDeleteAccount() {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRMATION_TEXT }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      toast.success('Account deleted successfully');

      // Redirect to homepage after brief delay
      setTimeout(() => {
        router.push(data.redirect || '/');
      }, 1000);
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete account'
      );
      setIsDeleting(false);
    }
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setConfirmationInput('');
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
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
              personal data. You can export your data above or delete your
              account in the Danger Zone below.
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

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
        </div>

        <div className="border-2 border-red-200 rounded-lg p-6 bg-red-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900">Delete Account</h3>
              <p className="text-sm text-gray-600">
                Permanently delete your account and all associated data
                including preferences, watched conversations, feedback history,
                and integrations.{' '}
                <span className="font-medium text-red-600">
                  This action cannot be undone.
                </span>
              </p>
            </div>
            <AlertDialog
              open={isDeleteDialogOpen}
              onOpenChange={handleDeleteDialogOpenChange}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="shrink-0">
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4">
                      <p>
                        This will permanently delete your account and all
                        associated data. You will be logged out immediately.
                      </p>
                      <p className="text-sm">This includes:</p>
                      <ul className="text-sm list-disc list-inside space-y-1 text-gray-600">
                        <li>Your style preferences and custom guidance</li>
                        <li>All watched conversations</li>
                        <li>Feedback and refinement history</li>
                        <li>Person context and notes</li>
                        <li>Google Sheets integration</li>
                        <li>Report settings and schedules</li>
                      </ul>
                      <div className="pt-2">
                        <label
                          htmlFor="confirmation"
                          className="text-sm font-medium text-gray-700"
                        >
                          Type{' '}
                          <span className="font-mono bg-gray-100 px-1 rounded">
                            {CONFIRMATION_TEXT}
                          </span>{' '}
                          to confirm:
                        </label>
                        <Input
                          id="confirmation"
                          type="text"
                          value={confirmationInput}
                          onChange={(e) => setConfirmationInput(e.target.value)}
                          placeholder={CONFIRMATION_TEXT}
                          className="mt-2"
                          autoComplete="off"
                          disabled={isDeleting}
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={!isConfirmed || isDeleting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAccount();
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
