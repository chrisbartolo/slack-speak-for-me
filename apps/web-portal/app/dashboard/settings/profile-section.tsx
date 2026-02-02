'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Mail, Check, Loader2 } from 'lucide-react';

interface ProfileSectionProps {
  currentEmail: string | null;
  slackUserId: string;
}

export function ProfileSection({ currentEmail, slackUserId }: ProfileSectionProps) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSaved(true);
      toast.success('Email updated successfully');
      router.refresh();

      // Reset saved state after 2 seconds
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = email.toLowerCase() !== (currentEmail || '').toLowerCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Manage your account details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slack-id">Slack User ID</Label>
          <Input
            id="slack-id"
            value={slackUserId}
            disabled
            className="bg-gray-50 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Your Slack identity (cannot be changed)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address
          </Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1"
            />
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="min-w-[100px]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for billing, referrals, and account notifications
          </p>
        </div>

        {!currentEmail && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>No email set.</strong> Add your email to enable referrals and individual billing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
