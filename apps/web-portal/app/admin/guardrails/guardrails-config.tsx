'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, AlertTriangle, Plus, X, Save, Info } from 'lucide-react';
import type { PlanFeatures } from '@/lib/admin/plan-features';

interface GuardrailCategory {
  id: string;
  name: string;
  description: string;
  keywords: readonly string[];
}

interface GuardrailConfig {
  id?: string;
  organizationId: string;
  enabledCategories: string[] | null;
  blockedKeywords: string[] | null;
  triggerMode: string | null;
  updatedAt: Date | null;
}

interface GuardrailsConfigProps {
  config: GuardrailConfig;
  planFeatures: PlanFeatures;
  predefinedCategories: readonly GuardrailCategory[];
}

const TRIGGER_MODES = [
  {
    value: 'hard_block' as const,
    label: 'Hard Block',
    description: 'Suppress suggestion entirely, show warning to user',
    severity: 'Strictest',
  },
  {
    value: 'regenerate' as const,
    label: 'Warning + Regenerate',
    description: 'AI regenerates without prohibited content, shows filter note',
    severity: 'Balanced',
  },
  {
    value: 'soft_warning' as const,
    label: 'Soft Warning',
    description: 'Deliver suggestion with visible warning flag',
    severity: 'Least strict',
  },
];

export function GuardrailsConfig({ config, planFeatures, predefinedCategories }: GuardrailsConfigProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Local state
  const [enabledCategories, setEnabledCategories] = useState<string[]>(config.enabledCategories || []);
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>(config.blockedKeywords || []);
  const [triggerMode, setTriggerMode] = useState<'hard_block' | 'regenerate' | 'soft_warning'>(
    (config.triggerMode as 'hard_block' | 'regenerate' | 'soft_warning') || 'hard_block'
  );
  const [newKeyword, setNewKeyword] = useState('');

  // Default categories that should be enabled by default
  const defaultCategories = ['legal_advice', 'pricing_commitments', 'competitor_bashing'];

  const handleToggleCategory = (categoryId: string) => {
    if (enabledCategories.includes(categoryId)) {
      setEnabledCategories(enabledCategories.filter((id) => id !== categoryId));
    } else {
      setEnabledCategories([...enabledCategories, categoryId]);
    }
  };

  const handleAddKeyword = () => {
    const keyword = newKeyword.trim();
    if (!keyword) {
      toast.error('Please enter a keyword');
      return;
    }

    if (keyword.length > 100) {
      toast.error('Keyword must be 100 characters or less');
      return;
    }

    if (blockedKeywords.includes(keyword)) {
      toast.error('This keyword is already in the list');
      return;
    }

    if (blockedKeywords.length >= planFeatures.maxBlockedKeywords) {
      toast.error(`Maximum ${planFeatures.maxBlockedKeywords} keywords allowed for your plan`);
      return;
    }

    setBlockedKeywords([...blockedKeywords, keyword]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    setBlockedKeywords(blockedKeywords.filter((k) => k !== keyword));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledCategories,
          blockedKeywords,
          triggerMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save configuration');
      }

      toast.success('Guardrail configuration saved');
      router.refresh();
    } catch (error) {
      console.error('Error saving guardrail config:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Configuration
        </CardTitle>
        <CardDescription>
          Define what content AI should avoid in suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trigger Mode */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Trigger Mode</h3>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid gap-3">
            {TRIGGER_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setTriggerMode(mode.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
                  triggerMode === mode.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{mode.label}</p>
                      <Badge variant={triggerMode === mode.value ? 'default' : 'outline'} className="text-xs">
                        {mode.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{mode.description}</p>
                  </div>
                  {triggerMode === mode.value && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Predefined Categories */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm mb-1">Predefined Categories</h3>
            <p className="text-sm text-muted-foreground">
              Toggle off-limits topics. AI will avoid suggesting these types of content.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
            {predefinedCategories.map((category) => {
              const isEnabled = enabledCategories.includes(category.id);
              const isDefault = defaultCategories.includes(category.id);

              return (
                <div
                  key={category.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isEnabled
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{category.name}</p>
                        {isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {category.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Examples: {category.keywords.slice(0, 3).join(', ')}
                        {category.keywords.length > 3 && '...'}
                      </p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggleCategory(category.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Keywords */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm mb-1">Custom Blocked Keywords</h3>
            <p className="text-sm text-muted-foreground">
              Add specific words or phrases to block. Case-insensitive, word boundary matching.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter keyword or phrase"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              disabled={blockedKeywords.length >= planFeatures.maxBlockedKeywords}
              maxLength={100}
            />
            <Button
              onClick={handleAddKeyword}
              disabled={blockedKeywords.length >= planFeatures.maxBlockedKeywords || !newKeyword.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {blockedKeywords.length} / {planFeatures.maxBlockedKeywords} keywords used
            </span>
            {blockedKeywords.length >= planFeatures.maxBlockedKeywords && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Limit reached
              </span>
            )}
          </div>

          {blockedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockedKeywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="pl-3 pr-1 py-1 flex items-center gap-2"
                >
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="hover:bg-background rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {planFeatures.maxBlockedKeywords === 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-900">
                Custom keywords are not available on your current plan. Upgrade to add custom blocked keywords.
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
