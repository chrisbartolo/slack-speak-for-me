'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { TagInput } from '@/components/forms/tag-input';
import { FileUploadZone } from './file-upload-zone';
import { CATEGORIES, type KnowledgeBaseDocument } from './document-list';

interface DocumentEditorProps {
  document: KnowledgeBaseDocument | null;
  onSave: () => void;
  onCancel: () => void;
}

const CONTENT_WARNING_THRESHOLD = 50000;

export function DocumentEditor({ document, onSave, onCancel }: DocumentEditorProps) {
  const isEditing = !!document;

  const [title, setTitle] = useState(document?.title ?? '');
  const [content, setContent] = useState(document?.content ?? '');
  const [category, setCategory] = useState(document?.category ?? 'other');
  const [tags, setTags] = useState<string[]>(document?.tags ?? []);
  const [sourceUrl, setSourceUrl] = useState(document?.sourceUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('write');

  // URL import state
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (content.trim().length < 10) {
      toast.error('Content must be at least 10 characters');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: tags.filter(Boolean),
        sourceUrl: sourceUrl.trim() || undefined,
      };

      const url = isEditing
        ? `/api/admin/knowledge-base/${document.id}`
        : '/api/admin/knowledge-base';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? 'Document updated' : 'Document created');
        onSave();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save document');
      }
    } catch {
      toast.error('Failed to save document');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileExtracted(extractedContent: string, filename: string) {
    setContent(extractedContent);
    if (!title.trim()) {
      // Use filename without extension as a title suggestion
      const suggestedTitle = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(suggestedTitle);
    }
    setActiveTab('write');
    toast.success(`Extracted text from ${filename}`);
  }

  async function handleUrlImport() {
    if (!importUrl.trim()) {
      toast.error('Enter a URL to import');
      return;
    }

    setImporting(true);

    try {
      const res = await fetch('/api/admin/knowledge-base/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to import URL');
        return;
      }

      setContent(data.content);
      if (!title.trim() && data.title) {
        setTitle(data.title);
      }
      if (!sourceUrl.trim()) {
        setSourceUrl(importUrl.trim());
      }
      setActiveTab('write');
      toast.success(`Imported ${data.wordCount} words from URL`);
    } catch {
      toast.error('Failed to import URL');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onCancel} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Documents
      </Button>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Document' : 'Add Document'}</CardTitle>
            <CardDescription>
              {isEditing
                ? 'Update the document details below'
                : 'Add a new knowledge base document for AI reference. You can write content directly, upload a file, or import from a URL.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., SLA Response Times, Product FAQ, Troubleshooting Guide"
                required
              />
            </div>

            {/* Content with Tabs */}
            <div className="space-y-2">
              <Label>Content *</Label>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                  <TabsTrigger value="import">Import URL</TabsTrigger>
                </TabsList>

                <TabsContent value="write" className="space-y-2 mt-3">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter or paste document content here..."
                    className="min-h-[400px] resize-y font-mono text-sm"
                    required
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{wordCount} words</span>
                    <span>{charCount} characters</span>
                  </div>
                  {charCount > CONTENT_WARNING_THRESHOLD && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Large documents are automatically split into chunks when saved.
                        Consider breaking this into separate documents for better AI retrieval.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="upload" className="mt-3">
                  <FileUploadZone
                    onContentExtracted={handleFileExtracted}
                    disabled={submitting}
                  />
                  {content && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Uploading a new file will replace the current content. Switch to the Write tab to review.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="import" className="mt-3">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          placeholder="https://docs.example.com/article"
                          className="pl-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUrlImport();
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleUrlImport}
                        disabled={importing || !importUrl.trim()}
                      >
                        {importing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Fetch'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fetches the page content and extracts text. The source URL will be saved with the document.
                    </p>
                    {content && (
                      <p className="text-xs text-muted-foreground">
                        Importing will replace the current content. Switch to the Write tab to review.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Metadata: Category, Source URL, Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">Source URL</Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://docs.example.com/sla"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  placeholder="e.g., support, billing, api"
                  maxTags={20}
                  maxLength={50}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Document' : 'Create Document'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
