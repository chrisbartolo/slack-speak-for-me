'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Gift, RotateCcw, Shield } from 'lucide-react';

interface UserPlanInfo {
  email: string;
  slackUserId: string;
  displayName: string;
  planId: string;
  subscriptionStatus: string | null;
  adminOverride: boolean;
  overrideReason: string | null;
  suggestionsUsed: number;
  suggestionsIncluded: number;
  bonusSuggestions: number;
  effectiveLimit: number;
  billingPeriodStart: Date | string | null;
  billingPeriodEnd: Date | string | null;
  workspaceName?: string | null;
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-gray-100 text-gray-700' },
  starter: { label: 'Starter', color: 'bg-blue-100 text-blue-700' },
  pro: { label: 'Pro', color: 'bg-purple-100 text-purple-700' },
  team: { label: 'Team', color: 'bg-green-100 text-green-700' },
  business: { label: 'Business', color: 'bg-amber-100 text-amber-700' },
};

export function PlanManagementTable({ users, showWorkspace = false }: { users: UserPlanInfo[]; showWorkspace?: boolean }) {
  const [selectedUser, setSelectedUser] = useState<UserPlanInfo | null>(null);
  const [dialogMode, setDialogMode] = useState<'plan' | 'grant' | 'reset' | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [newPlan, setNewPlan] = useState('');
  const [planReason, setPlanReason] = useState('');
  const [grantAmount, setGrantAmount] = useState('10');

  function openDialog(user: UserPlanInfo, mode: 'plan' | 'grant' | 'reset') {
    setSelectedUser(user);
    setDialogMode(mode);
    setNewPlan(user.planId);
    setPlanReason('');
    setGrantAmount('10');
    setMessage(null);
  }

  function closeDialog() {
    setSelectedUser(null);
    setDialogMode(null);
    setMessage(null);
  }

  async function handleAction() {
    if (!selectedUser || !dialogMode) return;

    setLoading(true);
    setMessage(null);

    try {
      const encodedEmail = encodeURIComponent(selectedUser.email);
      let body: Record<string, unknown>;

      switch (dialogMode) {
        case 'plan':
          body = { action: 'assign-plan', planId: newPlan, reason: planReason || 'Admin assignment' };
          break;
        case 'grant':
          body = { action: 'grant-usage', amount: parseInt(grantAmount, 10) };
          break;
        case 'reset':
          body = { action: 'reset-usage' };
          break;
      }

      const res = await fetch(`/api/admin/plan-management/${encodedEmail}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Action failed' });
        return;
      }

      setMessage({ type: 'success', text: data.message });

      // Reload page after short delay to show updated data
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {(['free', 'starter', 'pro', 'team'] as const).map((planId) => {
          const count = users.filter(u => u.planId === planId).length;
          const info = PLAN_LABELS[planId];
          return (
            <div key={planId} className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{info.label} Plan</div>
              <div className="text-2xl font-bold mt-1">{count}</div>
              <div className="text-xs text-muted-foreground">user{count !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Users table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              {showWorkspace && <TableHead>Workspace</TableHead>}
              <TableHead>Plan</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showWorkspace ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const planInfo = PLAN_LABELS[user.planId] || PLAN_LABELS.free;
                const usagePercent = user.effectiveLimit > 0
                  ? Math.min(100, (user.suggestionsUsed / user.effectiveLimit) * 100)
                  : 0;
                const isOverLimit = user.suggestionsUsed >= user.effectiveLimit;

                return (
                  <TableRow key={user.email}>
                    <TableCell>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    {showWorkspace && (
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{user.workspaceName || 'Unknown'}</span>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={planInfo.color}>
                          {planInfo.label}
                        </Badge>
                        {user.adminOverride && (
                          <span title={`Override: ${user.overrideReason || 'Admin assigned'}`}>
                            <Shield className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[140px]">
                        <div className="flex justify-between text-xs">
                          <span className={isOverLimit ? 'text-red-600 font-medium' : ''}>
                            {user.suggestionsUsed}/{user.effectiveLimit}
                          </span>
                          <span className="text-muted-foreground">{Math.round(usagePercent)}%</span>
                        </div>
                        <Progress
                          value={usagePercent}
                          className={`h-1.5 ${isOverLimit ? '[&>div]:bg-red-500' : ''}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.bonusSuggestions > 0 ? (
                        <Badge variant="outline" className="text-green-700 border-green-200">
                          +{user.bonusSuggestions}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(user, 'plan')}
                          title="Change plan"
                        >
                          <CreditCard className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(user, 'grant')}
                          title="Grant bonus suggestions"
                        >
                          <Gift className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDialog(user, 'reset')}
                          title="Reset usage"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!dialogMode} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'plan' && 'Change Plan'}
              {dialogMode === 'grant' && 'Grant Bonus Suggestions'}
              {dialogMode === 'reset' && 'Reset Usage Counter'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.displayName} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialogMode === 'plan' && (
              <>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={newPlan} onValueChange={setNewPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (5/mo)</SelectItem>
                      <SelectItem value="starter">Starter (25/mo)</SelectItem>
                      <SelectItem value="pro">Pro (75/mo)</SelectItem>
                      <SelectItem value="team">Team (50/mo)</SelectItem>
                      <SelectItem value="business">Business (100/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    placeholder="e.g. Goodwill, testing, external payment"
                    value={planReason}
                    onChange={(e) => setPlanReason(e.target.value)}
                  />
                </div>
              </>
            )}

            {dialogMode === 'grant' && (
              <div className="space-y-2">
                <Label>Bonus suggestions to add</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {selectedUser?.suggestionsUsed}/{selectedUser?.effectiveLimit}
                  {selectedUser?.bonusSuggestions ? ` (includes +${selectedUser.bonusSuggestions} bonus)` : ''}
                  . Adding {grantAmount} will raise the limit to{' '}
                  {(selectedUser?.effectiveLimit ?? 0) + parseInt(grantAmount || '0', 10)}.
                </p>
              </div>
            )}

            {dialogMode === 'reset' && (
              <p className="text-sm text-muted-foreground">
                This will reset <strong>{selectedUser?.displayName}</strong>&apos;s usage counter
                from {selectedUser?.suggestionsUsed} back to 0 for the current billing period.
                Bonus suggestions ({selectedUser?.bonusSuggestions ?? 0}) will remain.
              </p>
            )}

            {message && (
              <div className={`text-sm p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={loading}>
              {loading ? 'Processing...' : (
                dialogMode === 'plan' ? 'Assign Plan' :
                dialogMode === 'grant' ? 'Grant Suggestions' :
                'Reset Usage'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
