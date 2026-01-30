'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addWorkflowChannel, removeWorkflowChannel } from '@/app/dashboard/reports/actions';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface WorkflowChannel {
  id: string;
  channelId: string;
  channelName: string | null;
  enabled: boolean | null;
}

interface Props {
  channels: WorkflowChannel[];
  disabled?: boolean;
}

export function WorkflowConfigForm({ channels, disabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  const handleAddChannel = () => {
    if (!newChannelId.trim()) {
      toast.error('Please enter a channel ID');
      return;
    }

    startTransition(async () => {
      const result = await addWorkflowChannel(newChannelId, newChannelName || newChannelId);
      if (result.success) {
        toast.success('Channel added');
        setNewChannelId('');
        setNewChannelName('');
      } else {
        toast.error(result.error || 'Failed to add channel');
      }
    });
  };

  const handleRemoveChannel = (channelId: string) => {
    startTransition(async () => {
      const result = await removeWorkflowChannel(channelId);
      if (result.success) {
        toast.success('Channel removed');
      } else {
        toast.error(result.error || 'Failed to remove channel');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Monitoring</CardTitle>
        <CardDescription>
          Select which Slack channels to monitor for workflow form submissions from your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled && (
          <p className="text-sm text-gray-500">
            Configure Google Sheets above to enable workflow monitoring.
          </p>
        )}

        {/* Current channels */}
        {channels.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Monitored Channels</Label>
            <div className="space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <span className="text-sm">
                    #{channel.channelName || channel.channelId}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveChannel(channel.channelId)}
                    disabled={isPending || disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add channel form */}
        <div className={`space-y-3 ${channels.length > 0 ? 'pt-2 border-t' : ''}`}>
          <Label className="text-sm font-medium">Add Channel</Label>
          <div className="grid gap-2">
            <div>
              <Label htmlFor="channelId" className="text-xs text-gray-500">
                Channel ID
              </Label>
              <Input
                id="channelId"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                placeholder="C01234567"
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Right-click channel in Slack → View channel details → Copy ID at bottom
              </p>
            </div>
            <div>
              <Label htmlFor="channelName" className="text-xs text-gray-500">
                Channel Name (optional)
              </Label>
              <Input
                id="channelName"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="#weekly-updates"
                disabled={disabled}
              />
            </div>
            <Button
              onClick={handleAddChannel}
              disabled={isPending || disabled || !newChannelId.trim()}
              size="sm"
            >
              {isPending ? 'Adding...' : 'Add Channel'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
