import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
};

/**
 * POST /api/admin/knowledge-base/upload
 * Accepts a file upload, extracts text content, and returns it for review.
 * Does NOT save to the database — the client places extracted text in the editor.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    const ext = filename.substring(filename.lastIndexOf('.'));

    if (!SUPPORTED_TYPES[ext]) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${Object.keys(SUPPORTED_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let content: string;

    if (ext === '.pdf') {
      const { PDFParse } = await import('pdf-parse');
      const pdf = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await pdf.getText();
      content = result.text;
      await pdf.destroy();
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else {
      // .txt
      content = buffer.toString('utf-8');
    }

    const trimmed = content.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      content: trimmed,
      filename: file.name,
      wordCount,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}
