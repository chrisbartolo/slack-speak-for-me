'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Plus, Save, Loader2 } from 'lucide-react';

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
  const [newPreferredPhrase, setNewPreferredPhrase] = useState('');
  const [newAvoidPhrase, setNewAvoidPhrase] = useState('');

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveStyleSettings() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

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

      setSuccess('Style settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function toggleGlobalYolo(enabled: boolean) {
    try {
      setSavingYolo(true);
      setError(null);

      const res = await fetch('/api/admin/yolo-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global: enabled }),
      });

      if (!res.ok) throw new Error('Failed to update YOLO mode');

      setYoloSettings((prev) => ({ ...prev, globalEnabled: enabled }));

      // Update effective status for users without overrides
      setYoloSettings((prev) => ({
        ...prev,
        users: prev.users.map((user) => ({
          ...user,
          effectiveStatus: user.override !== null ? user.override : enabled,
        })),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update YOLO mode');
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
      setError(err instanceof Error ? err.message : 'Failed to update user setting');
    }
  }

  function addPreferredPhrase() {
    if (newPreferredPhrase.trim() && styleSettings.preferredPhrases.length < 20) {
      setStyleSettings({
        ...styleSettings,
        preferredPhrases: [...styleSettings.preferredPhrases, newPreferredPhrase.trim()],
      });
      setNewPreferredPhrase('');
    }
  }

  function removePreferredPhrase(index: number) {
    setStyleSettings({
      ...styleSettings,
      preferredPhrases: styleSettings.preferredPhrases.filter((_, i) => i !== index),
    });
  }

  function addAvoidPhrase() {
    if (newAvoidPhrase.trim() && styleSettings.avoidPhrases.length < 20) {
      setStyleSettings({
        ...styleSettings,
        avoidPhrases: [...styleSettings.avoidPhrases, newAvoidPhrase.trim()],
      });
      setNewAvoidPhrase('');
    }
  }

  function removeAvoidPhrase(index: number) {
    setStyleSettings({
      ...styleSettings,
      avoidPhrases: styleSettings.avoidPhrases.filter((_, i) => i !== index),
    });
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
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure organization-wide style guidelines and YOLO mode controls
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

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
            <div className="grid gap-3">
              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="styleMode"
                  value="fallback"
                  checked={styleSettings.styleMode === 'fallback'}
                  onChange={(e) =>
                    setStyleSettings({ ...styleSettings, styleMode: 'fallback' })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">User preferences first (Default)</div>
                  <div className="text-sm text-muted-foreground">
                    User preferences take priority, org settings fill gaps
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="styleMode"
                  value="layer"
                  checked={styleSettings.styleMode === 'layer'}
                  onChange={(e) => setStyleSettings({ ...styleSettings, styleMode: 'layer' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Org sets baseline</div>
                  <div className="text-sm text-muted-foreground">
                    Org provides defaults, users can customize within bounds
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="radio"
                  name="styleMode"
                  value="override"
                  checked={styleSettings.styleMode === 'override'}
                  onChange={(e) =>
                    setStyleSettings({ ...styleSettings, styleMode: 'override' })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Org overrides user</div>
                  <div className="text-sm text-muted-foreground">
                    Org style replaces user preferences entirely
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Tone */}
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

          {/* Formality */}
          <div className="space-y-2">
            <Label htmlFor="formality">Formality Level</Label>
            <select
              id="formality"
              value={styleSettings.formality || 'neutral'}
              onChange={(e) =>
                setStyleSettings({ ...styleSettings, formality: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {FORMALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Phrases */}
          <div className="space-y-2">
            <Label>Preferred Phrases</Label>
            <p className="text-xs text-muted-foreground">
              Phrases to encourage in AI responses (max 20)
            </p>
            <div className="flex gap-2">
              <Input
                value={newPreferredPhrase}
                onChange={(e) => setNewPreferredPhrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPreferredPhrase())}
                placeholder="Add a phrase..."
                maxLength={100}
                disabled={styleSettings.preferredPhrases.length >= 20}
              />
              <Button
                onClick={addPreferredPhrase}
                disabled={!newPreferredPhrase.trim() || styleSettings.preferredPhrases.length >= 20}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {styleSettings.preferredPhrases.map((phrase, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {phrase}
                  <button
                    onClick={() => removePreferredPhrase(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Avoid Phrases */}
          <div className="space-y-2">
            <Label>Avoid Phrases</Label>
            <p className="text-xs text-muted-foreground">
              Phrases to avoid in AI responses (max 20)
            </p>
            <div className="flex gap-2">
              <Input
                value={newAvoidPhrase}
                onChange={(e) => setNewAvoidPhrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAvoidPhrase())}
                placeholder="Add a phrase to avoid..."
                maxLength={100}
                disabled={styleSettings.avoidPhrases.length >= 20}
              />
              <Button
                onClick={addAvoidPhrase}
                disabled={!newAvoidPhrase.trim() || styleSettings.avoidPhrases.length >= 20}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {styleSettings.avoidPhrases.map((phrase, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {phrase}
                  <button
                    onClick={() => removeAvoidPhrase(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
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
