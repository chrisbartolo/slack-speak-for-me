'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free', description: '5 suggestions/user/mo' },
  { value: 'starter', label: 'Starter', description: '25 suggestions/user/mo' },
  { value: 'pro', label: 'Pro', description: '75 suggestions/user/mo' },
  { value: 'team', label: 'Team', description: '50 suggestions/seat/mo' },
  { value: 'business', label: 'Business', description: '100 suggestions/seat/mo' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'paused', label: 'Paused' },
];

interface OrgPlanFormProps {
  orgId: string;
  currentPlan: string | null;
  currentStatus: string | null;
  currentSeats: number | null;
}

export function OrgPlanForm({ orgId, currentPlan, currentStatus, currentSeats }: OrgPlanFormProps) {
  const [planId, setPlanId] = useState(currentPlan || 'free');
  const [status, setStatus] = useState(currentStatus || 'active');
  const [seatCount, setSeatCount] = useState(String(currentSeats || 1));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasChanges =
    planId !== (currentPlan || 'free') ||
    status !== (currentStatus || 'active') ||
    seatCount !== String(currentSeats || 1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-plan',
          planId,
          subscriptionStatus: status,
          seatCount: parseInt(seatCount, 10),
          reason: reason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
        return;
      }

      setMessage({ type: 'success', text: data.message });
      setReason('');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Organization Plan
          <Badge variant="secondary" className="ml-auto capitalize">
            {currentPlan || 'free'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label} — {plan.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Seats</Label>
              <Input
                type="number"
                min="1"
                value={seatCount}
                onChange={(e) => setSeatCount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Goodwill upgrade, partnership deal, testing"
            />
          </div>

          {message && (
            <div className={`text-sm p-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <Button type="submit" disabled={loading || !hasChanges} className="w-full">
            {loading ? 'Updating...' : 'Update Organization Plan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
