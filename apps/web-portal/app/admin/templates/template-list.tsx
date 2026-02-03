'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquare, Plus, Check, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { TemplateDialog } from './template-dialog';
import { RejectDialog } from './reject-dialog';

interface ResponseTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  templateType: 'canned' | 'starter' | 'playbook';
  content: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface TemplateListProps {
  templates: ResponseTemplate[];
  maxTemplates: number;
  approvedCount: number;
}

export function TemplateList({ templates, maxTemplates, approvedCount }: TemplateListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((t) => t.templateType === typeFilter);
    }

    return filtered;
  }, [templates, statusFilter, typeFilter]);

  // Count pending
  const pendingCount = templates.filter((t) => t.status === 'pending').length;

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleApprove = async (templateId: string) => {
    setProcessing(templateId);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve template');
      }

      toast.success('Template approved');
      router.refresh();
    } catch {
      toast.error('Failed to approve template');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async (reason?: string) => {
    if (!selectedTemplateId) return;

    setProcessing(selectedTemplateId);
    try {
      const response = await fetch(`/api/admin/templates/${selectedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject template');
      }

      toast.success('Template rejected');
      setRejectDialogOpen(false);
      setSelectedTemplateId(null);
      router.refresh();
    } catch {
      toast.error('Failed to reject template');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    setDeleting(templateId);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast.success('Template deleted');
      router.refresh();
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(null);
    }
  };

  const handleDialogClose = (success: boolean) => {
    setDialogOpen(false);
    if (success) {
      router.refresh();
    }
  };

  const toggleExpanded = (templateId: string) => {
    setExpandedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'canned':
        return 'Canned Response';
      case 'starter':
        return 'Response Starter';
      case 'playbook':
        return 'Situation Playbook';
      default:
        return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'canned':
        return 'bg-blue-100 text-blue-700';
      case 'starter':
        return 'bg-green-100 text-green-700';
      case 'playbook':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      {/* Header with count and New Template button */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="text-base px-4 py-2">
          {approvedCount} / {maxTemplates} templates
        </Badge>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filter tabs and type filter */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && <Badge className="ml-2">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="canned">Canned Response</SelectItem>
              <SelectItem value="starter">Response Starter</SelectItem>
              <SelectItem value="playbook">Situation Playbook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Template list */}
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Response Templates</CardTitle>
              <CardDescription>No templates found</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Create your first response template to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTemplates.map((template) => {
              const isExpanded = expandedTemplates.has(template.id);
              const contentPreview = template.content.length > 200
                ? template.content.slice(0, 200) + '...'
                : template.content;

              return (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="text-xl">{template.name}</CardTitle>
                          <Badge className={getTypeBadgeColor(template.templateType)}>
                            {getTypeLabel(template.templateType)}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(template.status)}>
                            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                          </Badge>
                        </div>
                        {template.description && (
                          <CardDescription className="line-clamp-2">
                            {template.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {template.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(template.id)}
                              disabled={processing === template.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(template.id)}
                              disabled={processing === template.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
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
                  <CardContent className="space-y-3">
                    {/* Content preview */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Content</h4>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
                        {isExpanded ? template.content : contentPreview}
                        {template.content.length > 200 && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto ml-2 text-xs"
                            onClick={() => toggleExpanded(template.id)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show more
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div>
                        Submitted by {template.submittedBy} on{' '}
                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                      {template.reviewedAt && (
                        <div>
                          Reviewed by {template.reviewedBy} on{' '}
                          {new Date(template.reviewedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {template.status === 'rejected' && template.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <h4 className="text-sm font-medium text-red-900 mb-1">Rejection Reason</h4>
                        <p className="text-sm text-red-700">{template.rejectionReason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TemplateDialog open={dialogOpen} onClose={handleDialogClose} />
      <RejectDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={handleRejectConfirm}
      />
    </>
  );
}
