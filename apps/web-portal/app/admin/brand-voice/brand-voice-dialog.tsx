'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';

interface BrandVoiceTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  toneGuidelines: string;
  approvedPhrases: string[] | null;
  forbiddenPhrases: string[] | null;
  responsePatterns: Array<{ situation: string; pattern: string }> | null;
  isDefault: boolean | null;
  applicableTo: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface BrandVoiceDialogProps {
  open: boolean;
  onClose: (success: boolean) => void;
  template: BrandVoiceTemplate | null;
}

export function BrandVoiceDialog({ open, onClose, template }: BrandVoiceDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [toneGuidelines, setToneGuidelines] = useState('');
  const [approvedPhrases, setApprovedPhrases] = useState<string[]>([]);
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>([]);
  const [responsePatterns, setResponsePatterns] = useState<Array<{ situation: string; pattern: string }>>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [applicableTo, setApplicableTo] = useState<string>('all');
  const [newApprovedPhrase, setNewApprovedPhrase] = useState('');
  const [newForbiddenPhrase, setNewForbiddenPhrase] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setToneGuidelines(template.toneGuidelines);
      setApprovedPhrases(template.approvedPhrases || []);
      setForbiddenPhrases(template.forbiddenPhrases || []);
      setResponsePatterns(template.responsePatterns || []);
      setIsDefault(template.isDefault ?? false);
      setApplicableTo(template.applicableTo || 'all');
    } else {
      // Reset for new template
      setName('');
      setDescription('');
      setToneGuidelines('');
      setApprovedPhrases([]);
      setForbiddenPhrases([]);
      setResponsePatterns([]);
      setIsDefault(false);
      setApplicableTo('all');
    }
    setNewApprovedPhrase('');
    setNewForbiddenPhrase('');
  }, [template, open]);

  const handleAddApprovedPhrase = () => {
    if (newApprovedPhrase.trim()) {
      if (newApprovedPhrase.length > 200) {
        toast.error('Phrase must be 200 characters or less');
        return;
      }
      setApprovedPhrases([...approvedPhrases, newApprovedPhrase.trim()]);
      setNewApprovedPhrase('');
    }
  };

  const handleRemoveApprovedPhrase = (index: number) => {
    setApprovedPhrases(approvedPhrases.filter((_, i) => i !== index));
  };

  const handleAddForbiddenPhrase = () => {
    if (newForbiddenPhrase.trim()) {
      if (newForbiddenPhrase.length > 200) {
        toast.error('Phrase must be 200 characters or less');
        return;
      }
      setForbiddenPhrases([...forbiddenPhrases, newForbiddenPhrase.trim()]);
      setNewForbiddenPhrase('');
    }
  };

  const handleRemoveForbiddenPhrase = (index: number) => {
    setForbiddenPhrases(forbiddenPhrases.filter((_, i) => i !== index));
  };

  const handleAddResponsePattern = () => {
    setResponsePatterns([...responsePatterns, { situation: '', pattern: '' }]);
  };

  const handleRemoveResponsePattern = (index: number) => {
    setResponsePatterns(responsePatterns.filter((_, i) => i !== index));
  };

  const handleUpdateResponsePattern = (index: number, field: 'situation' | 'pattern', value: string) => {
    const updated = [...responsePatterns];
    updated[index][field] = value;
    setResponsePatterns(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!toneGuidelines.trim()) {
      toast.error('Tone guidelines are required');
      return;
    }

    if (toneGuidelines.length > 2000) {
      toast.error('Tone guidelines must be 2000 characters or less');
      return;
    }

    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        toneGuidelines: toneGuidelines.trim(),
        approvedPhrases: approvedPhrases.length > 0 ? approvedPhrases : undefined,
        forbiddenPhrases: forbiddenPhrases.length > 0 ? forbiddenPhrases : undefined,
        responsePatterns: responsePatterns.length > 0 ? responsePatterns.filter(p => p.situation && p.pattern) : undefined,
        isDefault,
        applicableTo,
      };

      const url = template
        ? `/api/admin/brand-voice/${template.id}`
        : '/api/admin/brand-voice';
      const method = template ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      toast.success(template ? 'Template updated' : 'Template created');
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            Define tone guidelines and response patterns for your organization
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Professional Client Communication"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="For all client-facing communication"
            />
          </div>

          {/* Tone Guidelines */}
          <div>
            <Label htmlFor="toneGuidelines">
              Tone Guidelines * ({toneGuidelines.length}/2000 characters)
            </Label>
            <Textarea
              id="toneGuidelines"
              value={toneGuidelines}
              onChange={(e) => setToneGuidelines(e.target.value)}
              placeholder="Professional, empathetic, solution-oriented..."
              rows={4}
              required
              maxLength={2000}
            />
          </div>

          {/* Approved Phrases */}
          <div>
            <Label htmlFor="approvedPhrase">Approved Phrases</Label>
            <div className="flex gap-2">
              <Input
                id="approvedPhrase"
                value={newApprovedPhrase}
                onChange={(e) => setNewApprovedPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddApprovedPhrase();
                  }
                }}
                placeholder="Type a phrase and press Enter"
                maxLength={200}
              />
              <Button type="button" onClick={handleAddApprovedPhrase} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {approvedPhrases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {approvedPhrases.map((phrase, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800">
                    {phrase}
                    <button
                      type="button"
                      onClick={() => handleRemoveApprovedPhrase(idx)}
                      className="ml-1 hover:text-green-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Forbidden Phrases */}
          <div>
            <Label htmlFor="forbiddenPhrase">Forbidden Phrases</Label>
            <div className="flex gap-2">
              <Input
                id="forbiddenPhrase"
                value={newForbiddenPhrase}
                onChange={(e) => setNewForbiddenPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddForbiddenPhrase();
                  }
                }}
                placeholder="Type a phrase and press Enter"
                maxLength={200}
              />
              <Button type="button" onClick={handleAddForbiddenPhrase} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {forbiddenPhrases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {forbiddenPhrases.map((phrase, idx) => (
                  <Badge key={idx} variant="destructive">
                    {phrase}
                    <button
                      type="button"
                      onClick={() => handleRemoveForbiddenPhrase(idx)}
                      className="ml-1 hover:text-red-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Response Patterns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Response Patterns</Label>
              <Button type="button" onClick={handleAddResponsePattern} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Pattern
              </Button>
            </div>
            {responsePatterns.length > 0 && (
              <div className="space-y-3">
                {responsePatterns.map((pattern, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <Label className="text-xs">Pattern {idx + 1}</Label>
                      <Button
                        type="button"
                        onClick={() => handleRemoveResponsePattern(idx)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={pattern.situation}
                      onChange={(e) => handleUpdateResponsePattern(idx, 'situation', e.target.value)}
                      placeholder="Situation (e.g., Client reports a bug)"
                      maxLength={200}
                    />
                    <Textarea
                      value={pattern.pattern}
                      onChange={(e) => handleUpdateResponsePattern(idx, 'pattern', e.target.value)}
                      placeholder="Pattern (e.g., Acknowledge, apologize, provide timeline)"
                      rows={2}
                      maxLength={500}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applicable To */}
          <div>
            <Label htmlFor="applicableTo">Applicable To</Label>
            <Select value={applicableTo} onValueChange={setApplicableTo}>
              <SelectTrigger id="applicableTo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conversations</SelectItem>
                <SelectItem value="client_conversations">Client Conversations Only</SelectItem>
                <SelectItem value="internal_only">Internal Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Is Default */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isDefault">Set as Default</Label>
              <p className="text-sm text-muted-foreground">
                Apply this template automatically to matching conversations
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : template ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
