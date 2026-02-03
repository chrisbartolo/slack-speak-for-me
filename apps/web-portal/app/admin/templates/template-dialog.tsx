'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';

interface TemplateDialogProps {
  open: boolean;
  onClose: (success: boolean) => void;
}

export function TemplateDialog({ open, onClose }: TemplateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<'canned' | 'starter' | 'playbook'>('canned');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !content.trim()) {
      toast.error('Name and content are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          templateType,
          content: content.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create template');
      }

      toast.success('Template submitted for review');
      resetForm();
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setTemplateType('canned');
    setDescription('');
    setContent('');
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose(false);
    }
  };

  const contentLength = content.length;
  const descriptionLength = description.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Response Template</DialogTitle>
          <DialogDescription>
            Submit a template for admin review. Approved templates will be available to your team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting Follow-up"
              maxLength={100}
              required
            />
            <p className="text-xs text-muted-foreground">{name.length}/100 characters</p>
          </div>

          {/* Template Type */}
          <div className="space-y-3">
            <Label>Template Type *</Label>
            <RadioGroup value={templateType} onValueChange={(v) => setTemplateType(v as 'canned' | 'starter' | 'playbook')}>
              <Card className={templateType === 'canned' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="canned" id="type-canned" />
                    <div className="flex-1">
                      <Label htmlFor="type-canned" className="font-semibold cursor-pointer">
                        Canned Response
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Full pre-written response for common situations
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={templateType === 'starter' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="starter" id="type-starter" />
                    <div className="flex-1">
                      <Label htmlFor="type-starter" className="font-semibold cursor-pointer">
                        Response Starter
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Opening line or framework that AI personalizes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={templateType === 'playbook' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="playbook" id="type-playbook" />
                    <div className="flex-1">
                      <Label htmlFor="type-playbook" className="font-semibold cursor-pointer">
                        Situation Playbook
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Scenario guide with key points to hit
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when to use this template..."
              maxLength={500}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">{descriptionLength}/500 characters</p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Template content..."
              maxLength={5000}
              rows={10}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{contentLength}/5000 characters</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
