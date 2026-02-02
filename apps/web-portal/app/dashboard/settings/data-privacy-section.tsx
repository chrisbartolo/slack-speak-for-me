'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Shield, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export function DataPrivacySection() {
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
    <>
      {/* Data & Privacy Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data & Privacy
          </CardTitle>
          <CardDescription>
            Export or delete your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <Button
              onClick={handleExportData}
              disabled={exporting}
              variant="outline"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
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
        </CardContent>
      </Card>

      {/* What's exported */}
      <div className="text-sm text-gray-500 px-1">
        <p>
          Your exported data will be in JSON format and includes:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>User profile and workspace information</li>
          <li>Style preferences and report settings</li>
          <li>Person context notes you have created</li>
          <li>Watched conversations and thread participation</li>
          <li>Suggestion feedback and refinement history</li>
          <li>Integration status and consent records</li>
        </ul>
      </div>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 rounded-lg">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900">Delete Account</h3>
              <p className="text-sm text-gray-600">
                Permanently delete your account and all associated data.{' '}
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
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
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
                        <li>All integrations and settings</li>
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
                    disabled={!isConfirmed || isDeleting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAccount();
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
