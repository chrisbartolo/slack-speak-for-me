'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getGoogleAuthUrl, disconnectGoogle } from '@/app/(dashboard)/reports/actions';

type GoogleConnectionCardProps = {
  isConnected: boolean;
  connectedEmail?: string | null;
};

export function GoogleConnectionCard({ isConnected, connectedEmail }: GoogleConnectionCardProps) {
  const [isLoading, setIsLoading] = useState(false);

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
