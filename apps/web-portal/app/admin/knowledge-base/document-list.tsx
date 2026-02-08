'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, ExternalLink, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

export interface KnowledgeBaseDocument {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  embedding: string;
  sourceUrl: string | null;
  lastReviewedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CATEGORIES = [
  { value: 'product_features', label: 'Product Features' },
  { value: 'sla_policies', label: 'SLA Policies' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'faq', label: 'FAQ' },
  { value: 'other', label: 'Other' },
];

interface DocumentListProps {
  documents: KnowledgeBaseDocument[];
  onAdd: () => void;
  onEdit: (doc: KnowledgeBaseDocument) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (doc: KnowledgeBaseDocument) => Promise<void>;
}

export function DocumentList({
  documents,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
}: DocumentListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.content.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  async function handleDelete(id: string) {
    try {
      await onDelete(id);
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{documents.length} document{documents.length !== 1 ? 's' : ''}</CardTitle>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            {documents.length === 0 ? (
              <>
                <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first knowledge base document to help AI generate better responses
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">No matching documents</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filter
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-start justify-between gap-4 p-4 ${
                  !doc.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{doc.title}</h3>
                    {doc.category && (
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORIES.find((c) => c.value === doc.category)?.label ||
                          doc.category}
                      </Badge>
                    )}
                    {!doc.isActive && (
                      <Badge variant="destructive" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {doc.content.substring(0, 200)}
                    {doc.content.length > 200 && '...'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {doc.sourceUrl && (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                    <span>
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={doc.isActive}
                      onCheckedChange={() => onToggleActive(doc)}
                    />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Active
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(doc)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &ldquo;{doc.title}&rdquo;? This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
