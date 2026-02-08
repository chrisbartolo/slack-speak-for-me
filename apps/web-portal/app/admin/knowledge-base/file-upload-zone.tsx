'use client';

import { useRef, useState, DragEvent } from 'react';
import { Upload, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onContentExtracted: (content: string, filename: string) => void;
  disabled?: boolean;
}

export function FileUploadZone({ onContentExtracted, disabled }: FileUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to process file');
        return;
      }

      onContentExtracted(data.content, data.filename);
    } catch {
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'pointer-events-none'
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Extracting text...</p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Word (.docx), or plain text (.txt) &middot; Max 10MB
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <FileText className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
