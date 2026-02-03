# Phase 14: User Manual & Knowledge Base - Research

**Researched:** 2026-02-03
**Domain:** Next.js MDX documentation site, in-app help, knowledge base architecture
**Confidence:** HIGH

## Summary

This phase builds a comprehensive documentation and help center for Speak for Me, integrated into the existing Next.js web portal. The documentation must cover user guides, admin documentation, API reference, onboarding, troubleshooting, and FAQ -- all served from the same Next.js application that already powers the web portal.

The standard approach for Next.js documentation is **MDX with `@next/mdx`** -- the official Next.js package that allows Markdown files with embedded React components to serve as pages via the App Router's file-based routing. This is the right fit because: (1) the project already uses Next.js 16.1.5 with App Router, (2) content is authored by the team (not user-generated), (3) MDX files are statically rendered at build time for excellent performance, and (4) no external CMS dependency is needed. The documentation pages will live at public routes (e.g., `/docs/...`, `/help/...`) and use Tailwind Typography's `prose` classes for consistent styling within the established brand.

For in-app help, contextual help links will be added to dashboard pages pointing to relevant documentation articles. A client-side search using FlexSearch or MiniSearch will enable users to find articles quickly. The existing FAQ on the landing page will be expanded and cross-referenced with the knowledge base.

**Primary recommendation:** Use `@next/mdx` with file-based routing for documentation pages at `/docs/[...slug]`, styled with `@tailwindcss/typography` prose classes, and add contextual help links throughout the dashboard.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@next/mdx` | 16.x | MDX processing for Next.js | Official Next.js MDX package, handles compile-time MDX-to-JSX, supports App Router natively |
| `@mdx-js/loader` | 3.x | Webpack loader for MDX files | Required by `@next/mdx` for bundling MDX content |
| `@mdx-js/react` | 3.x | React context provider for MDX components | Enables custom component mapping in MDX files |
| `@types/mdx` | 2.x | TypeScript types for MDX | Type safety for MDX imports and component definitions |
| `@tailwindcss/typography` | 0.5.x | Prose styling for rendered content | Beautiful typographic defaults for Markdown-rendered HTML, used by all Next.js doc sites |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `remark-gfm` | 4.x | GitHub Flavored Markdown support | Tables, task lists, strikethrough, footnotes in MDX content |
| `rehype-slug` | 6.x | Auto-generate heading IDs | Required for linkable headings and table of contents |
| `rehype-autolink-headings` | 7.x | Add anchor links to headings | Enables users to share direct links to sections |
| `flexsearch` | 0.8.x | Client-side full-text search | Fast search across all documentation articles (runs in browser) |
| `gray-matter` | 4.x | Frontmatter parser for MDX files | Extract metadata (title, description, category) from content files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@next/mdx` (local files) | Nextra (docs framework) | Nextra adds its own theme layer and opinions; overkill when you have an established design system |
| `@next/mdx` | `next-mdx-remote` / `next-mdx-remote-client` | Remote MDX packages are for CMS-fetched content; local files with `@next/mdx` are simpler and better maintained |
| `flexsearch` | `minisearch` | MiniSearch is simpler but FlexSearch is faster for larger datasets; either works for ~100 articles |
| `@tailwindcss/typography` | Custom prose styles | Typography plugin is battle-tested and already matches Tailwind ecosystem used in this project |
| MDX in Next.js | External docs platform (GitBook, Readme.io) | External platforms fragment the user experience and add cost; integrated docs match the brand |

**Installation:**
```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx @tailwindcss/typography remark-gfm rehype-slug rehype-autolink-headings flexsearch gray-matter --workspace=web-portal
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── docs/                           # Public documentation (no auth)
│   │   ├── layout.tsx                  # Docs layout with sidebar nav + search
│   │   ├── page.tsx                    # Docs landing / table of contents
│   │   └── [...slug]/
│   │       └── page.tsx                # Dynamic route loading MDX content
│   ├── help/                           # Help center landing (public)
│   │   └── page.tsx                    # Search, categories, popular articles
│   └── dashboard/
│       └── (existing pages with help links added)
├── content/
│   ├── docs/
│   │   ├── getting-started/
│   │   │   ├── installation.mdx        # Slack app installation guide
│   │   │   ├── first-suggestion.mdx    # Getting your first AI suggestion
│   │   │   └── onboarding.mdx          # Complete onboarding walkthrough
│   │   ├── features/
│   │   │   ├── watching.mdx            # /watch and /unwatch commands
│   │   │   ├── suggestions.mdx         # How AI suggestions work
│   │   │   ├── refinement.mdx          # Refining suggestions
│   │   │   ├── style-settings.mdx      # Configuring your style
│   │   │   ├── reports.mdx             # Weekly report automation
│   │   │   └── shortcuts.mdx           # Message shortcuts ("Help me respond")
│   │   ├── admin/
│   │   │   ├── org-setup.mdx           # Organization setup
│   │   │   ├── billing.mdx             # Billing and subscription management
│   │   │   ├── team-management.mdx     # Managing team members
│   │   │   └── compliance.mdx          # GDPR, data export, deletion
│   │   ├── troubleshooting/
│   │   │   ├── common-issues.mdx       # Common problems and solutions
│   │   │   ├── permissions.mdx         # Slack permission issues
│   │   │   └── billing-issues.mdx      # Payment and subscription issues
│   │   ├── api/
│   │   │   └── integration.mdx         # API/integration documentation
│   │   └── faq.mdx                     # Comprehensive FAQ
│   └── _meta.ts                        # Navigation metadata / ordering
├── components/
│   ├── docs/
│   │   ├── docs-layout.tsx             # Docs page layout (sidebar + content)
│   │   ├── docs-sidebar.tsx            # Documentation navigation sidebar
│   │   ├── docs-search.tsx             # Search component (FlexSearch)
│   │   ├── docs-breadcrumb.tsx         # Breadcrumb navigation
│   │   ├── docs-toc.tsx                # Table of contents (right sidebar)
│   │   ├── docs-pagination.tsx         # Previous/Next article navigation
│   │   ├── callout.tsx                 # Info/Warning/Tip callout boxes
│   │   ├── step.tsx                    # Step-by-step instruction component
│   │   └── code-block.tsx              # Syntax-highlighted code block
│   └── help/
│       ├── help-link.tsx               # Contextual help link component
│       └── help-search.tsx             # Quick search for help center
├── lib/
│   └── docs/
│       ├── content.ts                  # MDX content loading utilities
│       ├── search-index.ts             # FlexSearch index builder
│       └── navigation.ts              # Docs navigation tree builder
└── mdx-components.tsx                  # Root MDX component overrides
```

### Pattern 1: Dynamic MDX Route with generateStaticParams
**What:** A catch-all dynamic route that loads MDX content files and pre-renders all pages at build time.
**When to use:** For the main documentation section where content is organized in folders.
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/mdx
// app/docs/[...slug]/page.tsx
import { notFound } from 'next/navigation';
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs/content';

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug: slug.split('/') }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug.join('/'));
  if (!doc) return {};

  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug.join('/'));
  if (!doc) notFound();

  const { default: Content } = await import(
    `@/content/docs/${slug.join('/')}.mdx`
  );

  return (
    <article className="prose prose-gray max-w-none dark:prose-invert">
      <h1>{doc.meta.title}</h1>
      <Content />
    </article>
  );
}
```

### Pattern 2: Content Loading with Frontmatter
**What:** Utility functions to read MDX files, extract frontmatter metadata, and build navigation trees.
**When to use:** For building the docs sidebar navigation, search index, and page metadata.
**Example:**
```typescript
// lib/docs/content.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content/docs');

export interface DocMeta {
  title: string;
  description: string;
  category: string;
  order: number;
}

export function getDocBySlug(slug: string) {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(source);

  return {
    slug,
    meta: data as DocMeta,
  };
}

export function getAllDocSlugs(): string[] {
  const slugs: string[] = [];

  function walk(dir: string, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.mdx')) {
        slugs.push(`${prefix}${entry.name.replace('.mdx', '')}`);
      }
    }
  }

  walk(CONTENT_DIR);
  return slugs;
}
```

### Pattern 3: Contextual Help Links in Dashboard
**What:** Small help icon links on each dashboard page that point to the relevant documentation article.
**When to use:** Every dashboard page should have contextual help pointing to its documentation.
**Example:**
```typescript
// components/help/help-link.tsx
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HelpLinkProps {
  href: string;          // e.g., "/docs/features/watching"
  label?: string;        // e.g., "Learn about watching conversations"
}

export function HelpLink({ href, label = 'Learn more' }: HelpLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          target="_blank"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

### Pattern 4: Tailwind Typography Plugin Registration (v4)
**What:** In Tailwind v4, plugins are registered via CSS imports, not config files.
**When to use:** Setting up prose styles for the documentation pages.
**Example:**
```css
/* globals.css - add the plugin import */
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

/* ... rest of existing CSS ... */
```

### Anti-Patterns to Avoid
- **External documentation platform:** Do NOT use GitBook, Readme.io, or similar hosted platforms. Fragments user experience, adds cost, and cannot match the existing brand styling.
- **Database-stored content:** Do NOT store documentation articles in the database. MDX files in the repository are version-controlled, reviewable, and statically rendered. Database adds unnecessary complexity for content that changes infrequently.
- **Building a custom Markdown parser:** Do NOT write custom Markdown-to-HTML conversion. `@next/mdx` handles this at compile time with full React component support.
- **Server-side search:** Do NOT build a server-side search API for ~50-100 documentation articles. Client-side FlexSearch is faster and eliminates a server roundtrip.
- **Separate documentation app:** Do NOT create a separate Next.js app for documentation. The docs should live within the existing web portal app to share layout, auth context, and brand styling.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom Markdown parser | `@next/mdx` | Handles JSX embedding, frontmatter, plugins, code highlighting, and integrates natively with App Router |
| Prose typography | Custom CSS for each HTML element | `@tailwindcss/typography` prose classes | Handles 50+ element styles (headings, lists, tables, blockquotes, code blocks) with dark mode support |
| Table of contents | Manual heading extraction | `rehype-slug` + custom TOC component reading headings from DOM | Handles anchor IDs, nested heading levels, and scroll position tracking |
| Full-text search | Custom search implementation | `flexsearch` with pre-built index | Handles fuzzy matching, relevance scoring, stemming across hundreds of articles in <5ms |
| GFM tables/task lists | Custom Markdown extensions | `remark-gfm` | Handles tables, strikethrough, task lists, footnotes, autolink literals |
| Heading anchor links | Custom heading wrapper | `rehype-autolink-headings` | Handles all heading levels, accessible aria labels, hover/focus states |
| Frontmatter parsing | Custom YAML parser | `gray-matter` | Handles YAML, JSON, TOML frontmatter with TypeScript types |

**Key insight:** MDX documentation is a solved problem. The `@next/mdx` + `remark` + `rehype` ecosystem provides a complete, battle-tested pipeline. Every custom solution you write is a maintenance burden that the ecosystem already handles correctly.

## Common Pitfalls

### Pitfall 1: Missing mdx-components.tsx
**What goes wrong:** MDX files render as blank pages or throw build errors.
**Why it happens:** The `mdx-components.tsx` file at the project root is REQUIRED for `@next/mdx` to work with App Router. It is not optional.
**How to avoid:** Create `apps/web-portal/mdx-components.tsx` (or at `src/` root if using src directory) before any MDX content is added.
**Warning signs:** Build errors mentioning "mdx-components", blank MDX pages, or "useMDXComponents is not a function".

### Pitfall 2: Tailwind Typography v4 Registration
**What goes wrong:** `prose` classes have no effect, documentation content appears unstyled.
**Why it happens:** In Tailwind v4 (which this project uses), plugins are registered via `@plugin` in CSS, NOT via `tailwind.config.ts`. The old `plugins: [require('@tailwindcss/typography')]` pattern does not work.
**How to avoid:** Add `@plugin "@tailwindcss/typography";` to `globals.css` after the `@import "tailwindcss";` line.
**Warning signs:** `prose` class on elements but no visible styling; raw HTML appearing instead of formatted content.

### Pitfall 3: Content Security Policy Blocking MDX
**What goes wrong:** MDX-rendered pages fail with CSP violations in production.
**Why it happens:** The existing CSP in `next.config.ts` already includes `'unsafe-inline'` and `'unsafe-eval'` for scripts, which should cover MDX. However, if any MDX content includes external images, iframes, or fonts not listed in the CSP, those will be blocked.
**How to avoid:** Audit any embedded content in MDX files against the existing CSP rules. If documentation includes screenshots hosted externally, add those domains to `img-src`.
**Warning signs:** Console errors showing "Refused to load" or "blocked by Content Security Policy".

### Pitfall 4: `pageExtensions` Breaking Existing Routes
**What goes wrong:** Adding `'mdx'` to `pageExtensions` causes existing `.tsx` routes to stop working or new MDX files to conflict with existing routes.
**Why it happens:** `pageExtensions` replaces the default list. If you forget to include `'ts'`, `'tsx'`, etc., existing pages break.
**How to avoid:** Always include ALL needed extensions: `pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx']`.
**Warning signs:** 404 errors on previously working pages after adding MDX configuration.

### Pitfall 5: Dynamic Import Path for MDX Files
**What goes wrong:** Dynamic `import()` of MDX files fails at build time or returns unexpected modules.
**Why it happens:** Webpack's dynamic imports require the path to start with a known directory prefix for code splitting. Fully dynamic paths like `import(slug)` do not work.
**How to avoid:** Use template literal with a fixed prefix: `import(`@/content/docs/${slug}.mdx`)`. Ensure the `content/docs` directory is included in the Webpack resolution.
**Warning signs:** Build warnings about "Cannot find module" or runtime errors on doc pages.

### Pitfall 6: Search Index Size
**What goes wrong:** The search index file becomes too large, causing slow initial page loads.
**Why it happens:** Indexing full article body text creates large JSON files.
**How to avoid:** Index only titles, descriptions, headings, and first 200 words of each article. Load the search index lazily (not on initial page load). For ~50-100 articles, the index should be under 100KB gzipped.
**Warning signs:** Search component loads slowly, large network request for search data on page load.

### Pitfall 7: Documentation Getting Stale
**What goes wrong:** Documentation describes features that have changed, leading to user confusion and support tickets.
**Why it happens:** Documentation lives separate from feature code, so it is not updated when features change.
**How to avoid:** Include documentation updates as part of feature plan tasks. Add a "Last updated" date to each article via frontmatter. Create a review checklist for major releases.
**Warning signs:** User reports of incorrect documentation; "Last updated" dates more than 3 months old.

## Code Examples

Verified patterns from official sources and project conventions:

### next.config.ts Update for MDX
```typescript
// Source: https://nextjs.org/docs/app/guides/mdx
// Note: The existing next.config.ts uses TypeScript (.ts), so we use createMDX with TS
import type { NextConfig } from "next";
import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const securityHeaders = [
  // ... existing security headers ...
];

const nextConfig: NextConfig = {
  output: 'standalone',
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  transpilePackages: ['@slack-speak/database'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
  },
});

export default withMDX(nextConfig);
```

### mdx-components.tsx (Root File)
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components
import type { MDXComponents } from 'mdx/types';
import { Callout } from '@/components/docs/callout';
import { Step } from '@/components/docs/step';

export function useMDXComponents(): MDXComponents {
  return {
    // Custom components available in all MDX files
    Callout,
    Step,
    // Override default HTML elements with styled versions
    h1: ({ children, ...props }) => (
      <h1 className="text-3xl font-bold text-gray-900 mb-6" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4" {...props}>{children}</h2>
    ),
    a: ({ children, href, ...props }) => (
      <a href={href} className="text-blue-600 hover:text-blue-800 underline" {...props}>{children}</a>
    ),
  };
}
```

### Example MDX Documentation Article
```mdx
---
title: "Watching Conversations"
description: "Learn how to use /watch and /unwatch to monitor Slack conversations for AI suggestions"
category: "features"
order: 1
---

# Watching Conversations

Speak for Me monitors specific Slack conversations and automatically suggests responses
when someone sends a message that may need your attention.

<Callout type="info">
  Suggestions are delivered as ephemeral messages -- only you can see them.
</Callout>

## How to Start Watching

<Step number={1}>
  Open the Slack channel or DM you want to monitor.
</Step>

<Step number={2}>
  Type `/watch` and press Enter.
</Step>

<Step number={3}>
  You will see a confirmation message. The bot will now suggest responses
  when new messages arrive in this conversation.
</Step>

## How to Stop Watching

Type `/unwatch` in any conversation you are currently monitoring.

## What Triggers a Suggestion?

| Trigger | Description |
|---------|-------------|
| Someone replies to your message | In any watched conversation |
| You are @mentioned | In any watched conversation |
| New message in active thread | Threads you have participated in |

<Callout type="tip">
  Use the **Conversations** page in the web portal to see all your
  watched conversations in one place.
</Callout>
```

### Docs Layout with Sidebar and TOC
```typescript
// app/docs/layout.tsx
import { DocsLayout } from '@/components/docs/docs-layout';

export const metadata = {
  title: {
    default: 'Documentation',
    template: '%s | Speak for Me Docs',
  },
  description: 'Speak for Me user documentation, guides, and knowledge base.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>;
}
```

### Callout Component
```typescript
// components/docs/callout.tsx
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, Lightbulb, AlertCircle } from 'lucide-react';

interface CalloutProps {
  type?: 'info' | 'warning' | 'tip' | 'danger';
  children: React.ReactNode;
}

const styles = {
  info: { bg: 'bg-blue-50 border-blue-200', icon: Info, color: 'text-blue-700' },
  warning: { bg: 'bg-yellow-50 border-yellow-200', icon: AlertTriangle, color: 'text-yellow-700' },
  tip: { bg: 'bg-green-50 border-green-200', icon: Lightbulb, color: 'text-green-700' },
  danger: { bg: 'bg-red-50 border-red-200', icon: AlertCircle, color: 'text-red-700' },
};

export function Callout({ type = 'info', children }: CalloutProps) {
  const { bg, icon: Icon, color } = styles[type];

  return (
    <div className={cn('border rounded-lg p-4 my-4 flex gap-3', bg)}>
      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', color)} />
      <div className={cn('text-sm', color)}>{children}</div>
    </div>
  );
}
```

### FlexSearch Client-Side Search
```typescript
// components/docs/docs-search.tsx (client component)
'use client';

import { useState, useEffect, useCallback } from 'react';
import FlexSearch from 'flexsearch';

interface SearchResult {
  slug: string;
  title: string;
  description: string;
  category: string;
}

// Lazy-load search index
let searchIndex: FlexSearch.Document<SearchResult> | null = null;

async function getSearchIndex() {
  if (searchIndex) return searchIndex;

  const res = await fetch('/docs/search-index.json');
  const data: SearchResult[] = await res.json();

  searchIndex = new FlexSearch.Document<SearchResult>({
    document: {
      id: 'slug',
      index: ['title', 'description'],
      store: ['title', 'description', 'category', 'slug'],
    },
    tokenize: 'forward',
  });

  for (const item of data) {
    searchIndex.add(item);
  }

  return searchIndex;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-mdx-remote` for local files | `@next/mdx` with file-based routing | 2024 (next-mdx-remote poorly maintained) | Simpler setup, better performance, no client-side JS for MDX |
| `tailwind.config.js` plugin registration | `@plugin` directive in CSS (Tailwind v4) | 2025 (Tailwind v4 release) | Must use CSS-based plugin registration, not config file |
| `getStaticPaths` + `getStaticProps` | `generateStaticParams` + Server Components | 2023 (App Router stable) | Simpler data loading, automatic static generation |
| Client-side MDX compilation | Build-time MDX compilation via `@next/mdx` | 2024 | No MDX runtime shipped to client, faster page loads |
| `useMDXComponents(components)` with parameter | `useMDXComponents()` no parameter | 2025 (Next.js 16.x) | Signature changed -- function takes no arguments, returns components directly |

**Deprecated/outdated:**
- `next-mdx-remote`: Poorly maintained as of 2025. Use `@next/mdx` for local content.
- `contentlayer`: Project abandoned in 2023. Do not use for new projects.
- Tailwind v3 plugin config: `plugins: [require('@tailwindcss/typography')]` does not work in Tailwind v4.
- `getStaticPaths`/`getStaticProps`: Pages Router API, replaced by `generateStaticParams` in App Router.

## Open Questions

Things that could not be fully resolved:

1. **@next/mdx with TypeScript next.config.ts**
   - What we know: Official docs show `next.config.mjs` (ESM JavaScript). The project uses `next.config.ts` (TypeScript).
   - What's unclear: Whether `createMDX` from `@next/mdx` works seamlessly with `.ts` config files in Next.js 16. It should, since Next.js 16 supports `next.config.ts` natively.
   - Recommendation: Test this during the first implementation task. If issues arise, rename to `next.config.mjs` with `// @ts-check` comment.

2. **FlexSearch TypeScript types**
   - What we know: FlexSearch v0.8 has improved TypeScript support but its types have historically been incomplete.
   - What's unclear: Whether `@types/flexsearch` or bundled types are complete in v0.8.x.
   - Recommendation: If types are poor, create a local `flexsearch.d.ts` declaration file. MiniSearch is an alternative with better TypeScript support.

3. **Exact article count and scope**
   - What we know: The success criteria require coverage of all features, admin docs, API docs, troubleshooting, and FAQ.
   - What's unclear: Exact number of articles needed. Estimate is 25-40 articles across all categories.
   - Recommendation: Start with the critical path (getting started, core features, admin basics) and expand incrementally.

## Content Plan

The documentation should cover these categories, mapped to success criteria:

### SC1: User Manual (All Features)
- Installation guide (adding to Slack workspace)
- Watching conversations (`/watch`, `/unwatch`)
- AI suggestions (how they work, what triggers them)
- Refinement (using the Refine modal)
- Style settings (configuring tone, formality, phrases)
- Message shortcuts ("Help me respond")
- Weekly reports (setup, configuration, generation)

### SC2: Knowledge Base / Workflows
- "Getting your first suggestion" walkthrough
- "Setting up weekly reports" end-to-end
- "Personalizing your AI style" guide
- "Managing multiple conversations" guide

### SC3: In-App Help Links
- Conversations page -> watching docs
- Style page -> style settings docs
- Reports page -> reports docs
- Billing page -> billing docs
- Settings page -> settings/GDPR docs

### SC4: Onboarding Guide
- Step-by-step first-time setup
- Interactive checklist or guided walkthrough

### SC5: Admin Documentation
- Organization setup
- Billing and subscription management
- Team/user management
- Compliance and audit features

### SC6: API/Integration Documentation
- Slack app permissions overview
- Google Sheets integration setup
- Webhook/API endpoints (if exposed)

### SC7: FAQ
- Expand existing 6 FAQ items to 15-20
- Organize by category (general, billing, features, troubleshooting)

## Sources

### Primary (HIGH confidence)
- [Next.js Official MDX Guide](https://nextjs.org/docs/app/guides/mdx) - Setup, configuration, file conventions
- [Next.js mdx-components.tsx Reference](https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components) - Required file specification
- [Next.js generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) - Static generation for dynamic routes
- Existing codebase analysis (Next.js 16.1.5, Tailwind v4, App Router, existing page patterns)

### Secondary (MEDIUM confidence)
- [Tailwind CSS Typography Plugin](https://github.com/tailwindlabs/tailwindcss-typography) - Prose class documentation (v4 migration verified via multiple sources)
- [FlexSearch GitHub](https://github.com/nextapps-de/flexsearch) - Client-side search capabilities
- [Tailwind v4 @plugin discussion](https://github.com/tailwindlabs/tailwindcss/discussions/14120) - Prose plugin registration in v4

### Tertiary (LOW confidence)
- FlexSearch TypeScript types completeness - based on community reports, needs validation
- `createMDX` with `.ts` config - official examples only show `.mjs`, but should work based on Next.js 16 TypeScript config support

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js documentation, widely used ecosystem
- Architecture: HIGH - Based on existing codebase patterns and official Next.js MDX guide
- Pitfalls: HIGH - Based on official docs, community issues, and project-specific config analysis
- Content plan: MEDIUM - Scope is estimated; actual article count depends on feature complexity
- Search implementation: MEDIUM - FlexSearch API verified but TypeScript integration needs validation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable ecosystem, no rapid changes expected)
