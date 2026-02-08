'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TagInput } from '@/components/forms/tag-input';

interface OrgStyleSettings {
  styleMode: 'override' | 'layer' | 'fallback';
  tone: string | null;
  formality: string | null;
  preferredPhrases: string[];
  avoidPhrases: string[];
  customGuidance: string | null;
}

interface YoloModeSettings {
  globalEnabled: boolean;
  userOverrides: Record<string, boolean>;
  users: Array<{
    slackUserId: string;
    email: string | null;
    role: string | null;
    override: boolean | null;
    effectiveStatus: boolean;
  }>;
}

const FORMALITY_OPTIONS = [
  { value: 'very_casual', label: 'Very Casual' },
  { value: 'casual', label: 'Casual' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
  { value: 'very_formal', label: 'Very Formal' },
];

const STYLE_MODES = [
  {
    value: 'fallback',
    label: 'User preferences first',
    sublabel: 'Default',
    description: 'User preferences take priority, org settings fill gaps',
  },
  {
    value: 'layer',
    label: 'Org sets baseline',
    description: 'Org provides defaults, users can customize within bounds',
  },
  {
    value: 'override',
    label: 'Org overrides user',
    description: 'Org style replaces user preferences entirely',
  },
];

export default function AdminSettingsPage() {
  // Org style state
  const [styleSettings, setStyleSettings] = useState<OrgStyleSettings>({
    styleMode: 'fallback',
    tone: '',
    formality: 'neutral',
    preferredPhrases: [],
    avoidPhrases: [],
    customGuidance: '',
  });

  // YOLO mode state
  const [yoloSettings, setYoloSettings] = useState<YoloModeSettings>({
    globalEnabled: false,
    userOverrides: {},
    users: [],
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingYolo, setSavingYolo] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);

      // Load org style settings
      const styleRes = await fetch('/api/admin/org-style');
      if (!styleRes.ok) throw new Error('Failed to load style settings');
      const styleData = await styleRes.json();

      setStyleSettings({
        styleMode: styleData.settings.styleMode || 'fallback',
        tone: styleData.settings.tone || '',
        formality: styleData.settings.formality || 'neutral',
        preferredPhrases: styleData.settings.preferredPhrases || [],
        avoidPhrases: styleData.settings.avoidPhrases || [],
        customGuidance: styleData.settings.customGuidance || '',
      });

      // Load YOLO mode settings
      const yoloRes = await fetch('/api/admin/yolo-mode');
      if (!yoloRes.ok) throw new Error('Failed to load YOLO mode settings');
      const yoloData = await yoloRes.json();

      setYoloSettings(yoloData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveStyleSettings() {
    try {
      setSaving(true);

      const res = await fetch('/api/admin/org-style', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleMode: styleSettings.styleMode,
          tone: styleSettings.tone || null,
          formality: styleSettings.formality || null,
          preferredPhrases: styleSettings.preferredPhrases,
          avoidPhrases: styleSettings.avoidPhrases,
          customGuidance: styleSettings.customGuidance || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('Style settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function toggleGlobalYolo(enabled: boolean) {
    try {
      setSavingYolo(true);

      const res = await fetch('/api/admin/yolo-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global: enabled }),
      });

      if (!res.ok) throw new Error('Failed to update YOLO mode');

      setYoloSettings((prev) => ({
        ...prev,
        globalEnabled: enabled,
        users: prev.users.map((user) => ({
          ...user,
          effectiveStatus: user.override !== null ? user.override : enabled,
        })),
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update YOLO mode');
    } finally {
      setSavingYolo(false);
    }
  }

  async function toggleUserYolo(userId: string, enabled: boolean | null) {
    try {
      const res = await fetch('/api/admin/yolo-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled }),
      });

      if (!res.ok) throw new Error('Failed to update user YOLO mode');

      const data = await res.json();

      setYoloSettings((prev) => ({
        ...prev,
        userOverrides: data.userOverrides,
        users: prev.users.map((user) =>
          user.slackUserId === userId
            ? {
                ...user,
                override: enabled,
                effectiveStatus: enabled !== null ? enabled : prev.globalEnabled,
              }
            : user
        ),
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user setting');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure organization-wide style guidelines and YOLO mode controls
        </p>
      </div>

      {/* Section 1: Org-Wide Style Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Org-Wide Style Guidelines</CardTitle>
          <CardDescription>
            Set organization-level AI communication standards for all team members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Style Mode */}
          <div className="space-y-3">
            <Label>Style Mode</Label>
            <p className="text-sm text-muted-foreground">
              How should org settings interact with individual user preferences?
            </p>
            <RadioGroup
              value={styleSettings.styleMode}
              onValueChange={(value) =>
                setStyleSettings({ ...styleSettings, styleMode: value as OrgStyleSettings['styleMode'] })
              }
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {STYLE_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={cn(
                    'relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-accent/50',
                    styleSettings.styleMode === mode.value && 'border-primary bg-accent/30 ring-1 ring-primary/20'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={mode.value} />
                    <span className="font-medium">{mode.label}</span>
                    {mode.sublabel && (
                      <Badge variant="secondary" className="text-xs">
                        {mode.sublabel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">
                    {mode.description}
                  </p>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Tone & Formality - Two Column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Input
                id="tone"
                value={styleSettings.tone || ''}
                onChange={(e) => setStyleSettings({ ...styleSettings, tone: e.target.value })}
                placeholder="e.g., Professional, Friendly, Direct"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Overall communication tone for AI suggestions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="formality">Formality Level</Label>
              <Select
                value={styleSettings.formality || 'neutral'}
                onValueChange={(value) =>
                  setStyleSettings({ ...styleSettings, formality: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preferred & Avoid Phrases - Two Column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Preferred Phrases</Label>
              <p className="text-xs text-muted-foreground">
                Phrases to encourage in AI responses
              </p>
              <TagInput
                value={styleSettings.preferredPhrases}
                onChange={(phrases) =>
                  setStyleSettings({ ...styleSettings, preferredPhrases: phrases })
                }
                placeholder="e.g., 'Thanks for reaching out'"
                maxTags={20}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Avoid Phrases</Label>
              <p className="text-xs text-muted-foreground">
                Phrases to avoid in AI responses
              </p>
              <TagInput
                value={styleSettings.avoidPhrases}
                onChange={(phrases) =>
                  setStyleSettings({ ...styleSettings, avoidPhrases: phrases })
                }
                placeholder="e.g., 'No worries'"
                maxTags={20}
                maxLength={100}
              />
            </div>
          </div>

          {/* Custom Guidance */}
          <div className="space-y-2">
            <Label htmlFor="customGuidance">Custom Guidance</Label>
            <Textarea
              id="customGuidance"
              value={styleSettings.customGuidance || ''}
              onChange={(e) =>
                setStyleSettings({ ...styleSettings, customGuidance: e.target.value })
              }
              placeholder="Additional guidance for AI response generation..."
              maxLength={2000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {styleSettings.customGuidance?.length || 0} / 2000
            </p>
          </div>

          <Button onClick={saveStyleSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Style Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: YOLO Mode Controls */}
      <Card>
        <CardHeader>
          <CardTitle>YOLO Mode (Auto-Send) Controls</CardTitle>
          <CardDescription>
            Manage automatic message sending permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> YOLO mode sends AI-generated messages without human review.
              Use with caution.
            </AlertDescription>
          </Alert>

          {/* Global Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="globalYolo" className="text-base">
                Global YOLO Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Default setting for all users (can be overridden per-user)
              </p>
            </div>
            <Switch
              id="globalYolo"
              checked={yoloSettings.globalEnabled}
              onCheckedChange={toggleGlobalYolo}
              disabled={savingYolo}
            />
          </div>

          <div className="text-sm">
            <strong>Currently:</strong>{' '}
            <Badge variant={yoloSettings.globalEnabled ? 'destructive' : 'secondary'}>
              {yoloSettings.globalEnabled ? 'ENABLED globally' : 'DISABLED globally'}
            </Badge>
          </div>

          {/* Per-User Overrides */}
          {yoloSettings.users.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-base">Per-User Overrides</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Override global setting for specific users
                </p>
              </div>

              <div className="border rounded-lg divide-y">
                {yoloSettings.users.map((user) => (
                  <div key={user.slackUserId} className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="font-medium">
                        {user.email || user.slackUserId}
                        {user.role === 'admin' && (
                          <Badge variant="outline" className="ml-2">
                            Admin
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.override === null ? (
                          <span>Using org default</span>
                        ) : (
                          <span>Override: {user.override ? 'Enabled' : 'Disabled'}</span>
                        )}
                        {' · '}
                        <Badge
                          variant={user.effectiveStatus ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {user.effectiveStatus ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {user.override !== null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserYolo(user.slackUserId, null)}
                        >
                          Reset to Default
                        </Button>
                      )}
                      <Switch
                        checked={user.override !== null ? user.override : yoloSettings.globalEnabled}
                        onCheckedChange={(checked) =>
                          toggleUserYolo(user.slackUserId, checked)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
