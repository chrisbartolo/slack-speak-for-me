import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';

/**
 * Check if a URL points to a private/internal IP address (SSRF prevention)
 */
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Block private IP ranges
    const privateRanges = [
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
      /^192\.168\.\d{1,3}\.\d{1,3}$/,
      /^169\.254\.\d{1,3}\.\d{1,3}$/,
      /^0\.0\.0\.0$/,
    ];

    return privateRanges.some((range) => range.test(hostname));
  } catch {
    return true;
  }
}

/**
 * Extract text content from HTML string
 */
function extractTextFromHtml(html: string): { text: string; title: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

  // Remove script and style tags with their contents
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Replace block-level tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<br[^>]*\/?>/gi, '\n');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespace
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  return { text: text.trim(), title };
}

/**
 * POST /api/admin/knowledge-base/import-url
 * Fetches a URL and extracts text content for knowledge base import.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are supported' },
        { status: 400 }
      );
    }

    // SSRF prevention
    if (isPrivateUrl(url)) {
      return NextResponse.json(
        { error: 'Cannot fetch internal or private URLs' },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SpeakForMe-KnowledgeBase/1.0',
        'Accept': 'text/html, text/plain, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let content: string;
    let title = '';

    if (contentType.includes('text/html')) {
      const extracted = extractTextFromHtml(rawText);
      content = extracted.text;
      title = extracted.title;
    } else {
      // Plain text or other text types
      content = rawText.trim();
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      content,
      title,
      wordCount,
    });
  } catch (error) {
    console.error('URL import error:', error);

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'URL fetch timed out after 15 seconds' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import URL' },
      { status: 500 }
    );
  }
}
