'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { BrandVoiceDialog } from './brand-voice-dialog';

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

interface BrandVoiceListProps {
  templates: BrandVoiceTemplate[];
}

export function BrandVoiceList({ templates: initialTemplates }: BrandVoiceListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BrandVoiceTemplate | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: BrandVoiceTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    setDeleting(templateId);
    try {
      const response = await fetch(`/api/admin/brand-voice/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast.success('Brand voice template deleted');
      router.refresh();
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(null);
    }
  };

  const handleDialogClose = (success: boolean) => {
    setDialogOpen(false);
    setEditingTemplate(null);
    if (success) {
      router.refresh();
    }
  };

  const getApplicableToLabel = (applicableTo: string | null) => {
    if (!applicableTo || applicableTo === 'all') return 'All';
    if (applicableTo === 'client_conversations') return 'Client Only';
    if (applicableTo === 'internal_only') return 'Internal Only';
    return applicableTo;
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {initialTemplates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand Voice Templates</CardTitle>
            <CardDescription>No templates created yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Create your first brand voice template to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {initialTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-xl">{template.name}</CardTitle>
                      {template.isDefault && (
                        <Badge className="bg-blue-100 text-blue-700">Default</Badge>
                      )}
                      <Badge variant="outline">
                        {getApplicableToLabel(template.applicableTo)}
                      </Badge>
                    </div>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleting === template.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tone Guidelines */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Tone Guidelines</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {template.toneGuidelines}
                  </p>
                </div>

                {/* Approved Phrases */}
                {template.approvedPhrases && template.approvedPhrases.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Approved Phrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {template.approvedPhrases.map((phrase, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800">
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forbidden Phrases */}
                {template.forbiddenPhrases && template.forbiddenPhrases.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Forbidden Phrases</h4>
                    <div className="flex flex-wrap gap-2">
                      {template.forbiddenPhrases.map((phrase, idx) => (
                        <Badge key={idx} variant="destructive">
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Patterns */}
                {template.responsePatterns && template.responsePatterns.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Response Patterns</h4>
                    <div className="space-y-2">
                      {template.responsePatterns.map((pattern, idx) => (
                        <Card key={idx} className="bg-muted/50">
                          <CardContent className="pt-4">
                            <div className="text-sm">
                              <div className="font-medium mb-1">Situation: {pattern.situation}</div>
                              <div className="text-muted-foreground">Pattern: {pattern.pattern}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BrandVoiceDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        template={editingTemplate}
      />
    </>
  );
}
