'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentList, type KnowledgeBaseDocument } from './document-list';
import { DocumentEditor } from './document-editor';

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingDoc, setEditingDoc] = useState<KnowledgeBaseDocument | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch('/api/admin/knowledge-base');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/knowledge-base/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Failed to delete');
    }

    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleToggleActive(doc: KnowledgeBaseDocument) {
    try {
      const res = await fetch(`/api/admin/knowledge-base/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !doc.isActive }),
      });

      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, isActive: !d.isActive } : d
          )
        );
        toast.success(doc.isActive ? 'Document deactivated' : 'Document activated');
      }
    } catch {
      toast.error('Failed to toggle document status');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {view === 'list' ? (
        <>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Knowledge Base</h1>
            <p className="text-muted-foreground mt-1">
              Upload product and service documentation for AI-powered suggestions
            </p>
          </div>

          <DocumentList
            documents={documents}
            onAdd={() => {
              setEditingDoc(null);
              setView('editor');
            }}
            onEdit={(doc) => {
              setEditingDoc(doc);
              setView('editor');
            }}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        </>
      ) : (
        <DocumentEditor
          document={editingDoc}
          onSave={() => {
            setView('list');
            fetchDocuments();
          }}
          onCancel={() => setView('list')}
        />
      )}
    </div>
  );
}
