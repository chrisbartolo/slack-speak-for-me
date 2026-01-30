'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getGoogleAuthUrl, disconnectGoogle, updateSpreadsheetConfig } from '@/app/dashboard/reports/actions';

type GoogleConnectionCardProps = {
  isConnected: boolean;
  connectedEmail?: string | null;
  spreadsheetId?: string | null;
  spreadsheetName?: string | null;
};

export function GoogleConnectionCard({
  isConnected,
  connectedEmail,
  spreadsheetId,
  spreadsheetName,
}: GoogleConnectionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [sheetId, setSheetId] = useState(spreadsheetId || '');
  const [sheetName, setSheetName] = useState(spreadsheetName || '');

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const authUrl = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      toast.error('Failed to connect to Google');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      const result = await disconnectGoogle();
      if (result.success) {
        toast.success('Google account disconnected');
      } else {
        toast.error(result.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      toast.error('Failed to disconnect Google account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSpreadsheet = () => {
    if (!sheetId.trim()) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    startTransition(async () => {
      const result = await updateSpreadsheetConfig(sheetId, sheetName || 'Weekly Updates');
      if (result.success) {
        toast.success('Spreadsheet configuration saved');
        setIsEditing(false);
      } else {
        toast.error(result.error || 'Failed to save');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Sheets Integration</CardTitle>
        <CardDescription>
          Connect your Google account to enable weekly report exports to Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Connected to Google</p>
                {connectedEmail && (
                  <p className="text-sm text-gray-600">{connectedEmail}</p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>

            {/* Spreadsheet configuration */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Spreadsheet</Label>
                {!isEditing && spreadsheetId && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>

              {isEditing || !spreadsheetId ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="sheetId" className="text-xs text-gray-500">
                      Spreadsheet ID (from Google Sheets URL)
                    </Label>
                    <Input
                      id="sheetId"
                      value={sheetId}
                      onChange={(e) => setSheetId(e.target.value)}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Find in URL: docs.google.com/spreadsheets/d/<strong>[this-part]</strong>/edit
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="sheetName" className="text-xs text-gray-500">
                      Display Name (optional)
                    </Label>
                    <Input
                      id="sheetName"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder="Weekly Team Updates"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveSpreadsheet}
                      disabled={isPending}
                    >
                      {isPending ? 'Saving...' : 'Save'}
                    </Button>
                    {spreadsheetId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setSheetId(spreadsheetId);
                          setSheetName(spreadsheetName || '');
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm">
                  <span className="font-medium">{spreadsheetName || 'Unnamed Spreadsheet'}</span>
                  <span className="text-gray-500 ml-2">({spreadsheetId.substring(0, 20)}...)</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Not connected</p>
              <p className="text-sm text-gray-600">
                Connect to enable automatic Google Sheets exports
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? 'Connecting...' : 'Connect Google Account'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
