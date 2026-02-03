# Phase 14: User Manual & Knowledge Base - Research (Fumadocs)

**Researched:** 2026-02-03
**Domain:** Fumadocs documentation framework integrated into existing Next.js web portal
**Confidence:** HIGH

## Summary

This phase builds a comprehensive documentation and help center for Speak for Me using **Fumadocs** -- a React.js documentation framework purpose-built for Next.js. Fumadocs replaces the previous plan of raw `@next/mdx` with custom-built sidebar, search, TOC, breadcrumbs, and pagination components. The framework provides all of these out-of-the-box, eliminating approximately 8-10 custom components and utility files.

Fumadocs is organized into three packages: `fumadocs-core` (headless utilities), `fumadocs-ui` (pre-built layouts and components), and `fumadocs-mdx` (MDX content processing with type-safe output). The current major version is **v16**, which requires React 19.2+ (project has 19.2.3) and supports Tailwind CSS v4 natively (since v15). The framework is ESM-only, which aligns with the project's existing ESM module setup.

The critical architecture decision is to **scope Fumadocs to the `/docs` route using Next.js route groups**, keeping the existing app layout untouched. The `RootProvider` from Fumadocs will wrap only the docs section, not the entire application. This avoids CSS variable conflicts with the existing shadcn/ui theme and keeps the existing app completely unaffected. Fumadocs uses `--color-fd-*` prefixed CSS variables specifically to avoid collisions.

**Primary recommendation:** Install `fumadocs-core`, `fumadocs-ui`, and `fumadocs-mdx`. Configure docs under `app/(docs)/docs/` route group with Fumadocs `RootProvider` scoped to that group only. Use `fumadocs-ui/css/neutral.css` preset with custom CSS variable overrides for brand colors. Content lives in `content/docs/` with `meta.json` files controlling sidebar ordering.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fumadocs-core` | ^16.5.x | Headless doc utilities: source loader, page tree, search, TOC | Core engine of the framework; provides `loader()`, page tree generation, search server |
| `fumadocs-ui` | ^16.5.x | Pre-built layouts, MDX components, search dialog, theme | Provides DocsLayout, DocsPage, Callout, Steps, Tabs, Cards, breadcrumbs, pagination -- eliminates all custom component building |
| `fumadocs-mdx` | ^14.2.x | MDX content processing, type-safe collections, build-time compilation | Transforms MDX files into type-safe data; generates `.source` directory with typed content; handles remark/rehype plugins |
| `@types/mdx` | ^2.x | TypeScript types for MDX | Required for type safety in MDX component definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fumadocs-openapi` | ^9.3.x | OpenAPI documentation rendering | If API/integration documentation requires rendering from an OpenAPI spec |
| `@tailwindcss/typography` | ^0.5.x | Prose styling for rendered content | Only if Fumadocs' built-in typography needs supplementing (likely not needed -- Fumadocs has its own prose styles) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fumadocs | Raw `@next/mdx` + custom components | Requires building sidebar, search, TOC, breadcrumbs, pagination, callouts, steps from scratch (~10 custom components). Fumadocs provides all of these. |
| Fumadocs | Nextra | Nextra is more opinionated and harder to integrate into an existing app with its own layout system |
| Fumadocs | Docusaurus | Separate app entirely; cannot share layout/auth/brand with existing web portal |
| Fumadocs built-in search (Orama) | FlexSearch client-side | Fumadocs' built-in search is zero-config via `createFromSource()`. No need for a separate search library. |

**Installation:**
```bash
npm install fumadocs-core fumadocs-ui fumadocs-mdx @types/mdx --workspace=web-portal
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web-portal/
├── app/
│   ├── (main)/                          # Route group for existing app (rename from current root)
│   │   ├── layout.tsx                   # Existing root layout (untouched)
│   │   ├── page.tsx                     # Landing page
│   │   ├── dashboard/                   # Existing dashboard
│   │   ├── pricing/                     # Existing pricing
│   │   ├── privacy/                     # Existing privacy
│   │   ├── terms/                       # Existing terms
│   │   ├── admin/                       # Existing admin
│   │   ├── (auth)/                      # Existing auth
│   │   ├── api/                         # Existing API routes
│   │   └── install/                     # Existing install
│   ├── (docs)/                          # Route group for Fumadocs
│   │   ├── layout.tsx                   # Docs root layout with RootProvider
│   │   └── docs/                        # /docs URL path
│   │       ├── layout.tsx               # DocsLayout with sidebar + navigation
│   │       ├── [[...slug]]/
│   │       │   └── page.tsx             # Dynamic MDX page renderer
│   │       └── api/
│   │           └── search/
│   │               └── route.ts         # Built-in Orama search API
│   └── layout.tsx                       # Shared root layout (fonts, metadata base)
├── content/
│   └── docs/
│       ├── index.mdx                    # Docs landing page
│       ├── meta.json                    # Root sidebar ordering
│       ├── getting-started/
│       │   ├── meta.json                # Section ordering
│       │   ├── index.mdx                # Section overview
│       │   ├── installation.mdx         # Slack app installation
│       │   ├── first-suggestion.mdx     # Getting first AI suggestion
│       │   └── onboarding.mdx           # Complete onboarding walkthrough
│       ├── features/
│       │   ├── meta.json
│       │   ├── watching.mdx             # /watch and /unwatch
│       │   ├── suggestions.mdx          # How AI suggestions work
│       │   ├── refinement.mdx           # Refining suggestions
│       │   ├── style-settings.mdx       # Style configuration
│       │   ├── reports.mdx              # Weekly reports
│       │   └── shortcuts.mdx            # Message shortcuts
│       ├── admin/
│       │   ├── meta.json
│       │   ├── org-setup.mdx
│       │   ├── billing.mdx
│       │   ├── team-management.mdx
│       │   └── compliance.mdx
│       ├── troubleshooting/
│       │   ├── meta.json
│       │   ├── common-issues.mdx
│       │   ├── permissions.mdx
│       │   └── billing-issues.mdx
│       ├── api/
│       │   ├── meta.json
│       │   └── integration.mdx
│       └── faq.mdx
├── lib/
│   └── source.ts                        # Fumadocs source loader configuration
├── source.config.ts                     # Fumadocs MDX collection definitions (project root of web-portal)
└── .source/                             # Auto-generated (add to .gitignore)
```

**CRITICAL: Route Group Strategy**

The existing app pages must move into a `(main)` route group. The docs live in a `(docs)` route group. Both share the top-level `app/layout.tsx` for fonts and base HTML, but have separate sub-layouts. This is the official Next.js pattern for multiple root layouts and is the recommended Fumadocs approach for integration into existing apps.

**Alternative (simpler but with provider considerations):** Place `RootProvider` in the root `app/layout.tsx` wrapping the entire app, and put docs at `app/docs/` directly without route groups. This is simpler but means Fumadocs CSS and providers wrap the entire app. Given the existing shadcn/ui setup, the route group approach is safer.

### Pattern 1: Source Configuration (`source.config.ts`)
**What:** Defines content collections with frontmatter schema validation using Zod.
**When to use:** Project setup -- this file lives at the web-portal root.
```typescript
// apps/web-portal/source.config.ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: (ctx) => ({
      // Extend default frontmatter with custom fields
      index: z.boolean().default(false),
      category: z.string().optional(),
    }),
  },
});

export default defineConfig();
```

### Pattern 2: Source Loader (`lib/source.ts`)
**What:** Creates the Fumadocs source object used for page tree, search, and static generation.
**When to use:** Imported by layout.tsx, page.tsx, and search route.
```typescript
// apps/web-portal/lib/source.ts
import { docs, meta } from '@/.source';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

### Pattern 3: Docs Root Layout with Scoped RootProvider
**What:** Wraps only the docs section with Fumadocs' context provider.
**When to use:** The `(docs)/layout.tsx` file.
```typescript
// app/(docs)/layout.tsx
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

// Import Fumadocs styles -- scoped via the route group
import 'fumadocs-ui/css/neutral.css';
import 'fumadocs-ui/css/preset.css';

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

### Pattern 4: DocsLayout with Sidebar Configuration
**What:** The docs sub-layout that provides sidebar navigation, search, and page structure.
**When to use:** `app/(docs)/docs/layout.tsx`.
```typescript
// app/(docs)/docs/layout.tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: 'Speak for Me Docs',
        // Can include logo as ReactNode
      }}
    >
      {children}
    </DocsLayout>
  );
}
```

### Pattern 5: Dynamic Doc Page with Built-in Components
**What:** The catch-all route that renders individual documentation pages.
**When to use:** `app/(docs)/docs/[[...slug]]/page.tsx`.
```typescript
// app/(docs)/docs/[[...slug]]/page.tsx
import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
```

### Pattern 6: Built-in Search API Route
**What:** Zero-config search server powered by Orama.
**When to use:** `app/(docs)/docs/api/search/route.ts`.
```typescript
// app/(docs)/docs/api/search/route.ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source, {
  language: 'english',
});
```

### Pattern 7: Sidebar Ordering with `meta.json`
**What:** Controls the order and display of items in the sidebar navigation.
**When to use:** Place in each content folder.
```json
// content/docs/meta.json
{
  "title": "Documentation",
  "pages": [
    "index",
    "---Getting Started---",
    "getting-started",
    "---Features---",
    "features",
    "---Administration---",
    "admin",
    "---Help---",
    "troubleshooting",
    "faq",
    "api"
  ]
}
```

```json
// content/docs/getting-started/meta.json
{
  "title": "Getting Started",
  "pages": ["index", "installation", "first-suggestion", "onboarding"],
  "defaultOpen": true
}
```

### Pattern 8: Contextual Help Links in Dashboard
**What:** Small help icon links on dashboard pages pointing to relevant docs.
**When to use:** Every dashboard page should have contextual help.
```typescript
// components/help/help-link.tsx
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HelpLinkProps {
  href: string;
  label?: string;
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

### Anti-Patterns to Avoid
- **Wrapping the entire app with Fumadocs RootProvider:** Do NOT place `RootProvider` in the global `app/layout.tsx`. This would inject Fumadocs CSS variables and `next-themes` into the existing app, potentially conflicting with the existing shadcn/ui theme. Use route groups to scope it.
- **Building custom sidebar/TOC/search/breadcrumbs:** Do NOT hand-build these components. Fumadocs provides `DocsLayout` (sidebar + navigation), `DocsPage` (TOC + breadcrumbs + pagination), and `createFromSource` (search). This is the entire point of using Fumadocs.
- **Using `mdx-components.tsx` file:** Since Fumadocs MDX v10, the `mdx-components.tsx` file convention is NOT used. Components are passed explicitly via the `components` prop on the MDX body component. Do NOT create a root `mdx-components.tsx`.
- **Using `@next/mdx` alongside Fumadocs:** Fumadocs MDX has its own `createMDX` from `fumadocs-mdx/next` that wraps the Next.js config. Do NOT also use `@next/mdx` -- they serve different purposes and will conflict.
- **Storing MDX content in the database:** Content should be MDX files in the `content/` directory, version-controlled and statically rendered.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar navigation | Custom sidebar component with nav tree builder | `DocsLayout` from `fumadocs-ui/layouts/docs` | Handles page tree rendering, collapsible folders, active state, mobile responsive, prefetching |
| Table of contents | Custom TOC component parsing headings | `DocsPage` `toc` prop from `fumadocs-ui/layouts/docs/page` | Handles heading extraction, scroll position tracking, nested levels, popover on mobile |
| Full-text search | FlexSearch/MiniSearch with custom index builder | `createFromSource()` from `fumadocs-core/search/server` | Zero-config Orama-based search; structured data indexing; search dialog UI included |
| Breadcrumbs | Custom breadcrumb component | Built into `DocsPage` component | Automatically derived from page tree folder structure |
| Previous/Next pagination | Custom pagination component | Built into `DocsPage` footer | Automatically finds neighbor pages from page tree |
| Callout/Admonition boxes | Custom callout component | `Callout` from `fumadocs-ui/components/callout` | Supports info, warning, error types with proper styling |
| Step-by-step instructions | Custom step component | `Steps`/`Step` from `fumadocs-ui/components/steps` | Or use `fd-steps`/`fd-step` CSS utility classes directly |
| Tabs | Custom tabs component | `Tabs`/`Tab` from `fumadocs-ui/components/tabs` | Supports persistent state, shared values across tab groups |
| Card grids | Custom card layout | `Cards`/`Card` from `fumadocs-ui/components/card` | Pre-styled for documentation navigation |
| Prose typography | `@tailwindcss/typography` + custom overrides | Fumadocs built-in prose styling | Included in `fumadocs-ui/css/preset.css`; handles all typography consistently |
| MDX compilation pipeline | `@next/mdx` + remark/rehype plugins | `fumadocs-mdx` with `createMDX()` | Type-safe collections, `.source` generation, Turbopack compatible, build-time validation |
| Content frontmatter parsing | `gray-matter` + custom utilities | `fumadocs-mdx` schema in `source.config.ts` | Zod-validated frontmatter at build time; type-safe access in components |
| Navigation tree builder | Custom `lib/docs/navigation.ts` | `source.pageTree` from `fumadocs-core/source` loader | Automatic page tree from file structure + `meta.json` ordering |

**Key insight:** Fumadocs eliminates approximately 10-12 custom components and 3-4 utility modules that the raw `@next/mdx` approach required. The framework is specifically designed as a "library not a framework" that plugs into existing Next.js apps.

## Common Pitfalls

### Pitfall 1: CSS Variable Conflicts with Existing shadcn/ui Theme
**What goes wrong:** Fumadocs injects its own CSS variables (`--color-fd-background`, `--color-fd-foreground`, etc.) which could conflict with existing shadcn/ui variables (`--background`, `--foreground`).
**Why it happens:** Both libraries use similar naming conventions for color tokens. Fumadocs v15+ uses `fd-` prefix by default to avoid this.
**How to avoid:** Use route groups to scope Fumadocs CSS imports to only the `(docs)` layout. Import `fumadocs-ui/css/neutral.css` and `fumadocs-ui/css/preset.css` only in the docs root layout, NOT in the global `globals.css`. The `fd-` prefix on Fumadocs variables ensures no collision.
**Warning signs:** Existing app pages change appearance after Fumadocs installation; background colors or text colors shift globally.

### Pitfall 2: Route Group Migration Breaking Existing Routes
**What goes wrong:** Moving existing pages into a `(main)` route group breaks all existing routes, causes 404 errors.
**Why it happens:** Route groups require careful restructuring. If any layout files or API routes are misplaced, Next.js cannot resolve them.
**How to avoid:** Plan the route group migration carefully. The `(main)` group should contain ALL existing app content exactly as-is, with the same folder structure. Route groups do NOT affect the URL path -- `(main)/pricing/page.tsx` still serves `/pricing`. Test ALL existing routes after migration.
**Warning signs:** 404 errors on existing pages; layout shifts; API routes returning errors.

### Pitfall 3: Missing `.source` Directory Generation
**What goes wrong:** Build fails with "Cannot find module '@/.source'" or similar import errors.
**Why it happens:** The `.source` directory is auto-generated by `fumadocs-mdx` when running `next dev` or `next build`. If it does not exist (first run, CI/CD, clean checkout), imports fail.
**How to avoid:** Add a `postinstall` script to `package.json`: `"postinstall": "fumadocs-mdx"`. Also add `.source/` to `.gitignore`. Ensure CI/CD runs `npm install` (which triggers postinstall) before build.
**Warning signs:** Build errors referencing `.source` path; TypeScript errors about missing modules; blank pages in development.

### Pitfall 4: `next.config.ts` Wrapping Order
**What goes wrong:** MDX content does not render; pages show raw text or 404.
**Why it happens:** `createMDX()` from `fumadocs-mdx/next` must wrap the Next.js config. If the existing config has custom headers, output settings, or other plugins, the wrapping must preserve them.
**How to avoid:** Apply `withMDX` as the outermost wrapper: `export default withMDX(nextConfig)`. Ensure the import is `{ createMDX }` (named export) from `fumadocs-mdx/next`, NOT from `@next/mdx`.
**Warning signs:** MDX files 404; raw MDX source shown instead of rendered content; build warnings about MDX.

### Pitfall 5: `meta.json` Items Not Listed Are Excluded
**What goes wrong:** New MDX files are created but do not appear in the sidebar.
**Why it happens:** When a `meta.json` file has a `pages` array, ONLY items listed in that array appear. Items not listed are excluded. This is by design but surprises content authors.
**How to avoid:** Use the rest operator `"..."` at the end of the `pages` array to include unlisted items alphabetically. Or maintain the `pages` array as the source of truth and update it when adding new content.
**Warning signs:** New articles not visible in sidebar; content exists at URL but has no sidebar entry.

### Pitfall 6: Fumadocs CSS Not Loading (Tailwind v4 Source Directive)
**What goes wrong:** Fumadocs UI components render without styling; layouts broken.
**Why it happens:** In Tailwind CSS v4, you must add a `@source` directive to tell Tailwind to scan Fumadocs' distribution files for utility classes.
**How to avoid:** Add `@source '../node_modules/fumadocs-ui/dist/**/*.js';` to your CSS file alongside the Fumadocs imports. This is only needed if Fumadocs CSS is imported in a CSS file processed by Tailwind.
**Warning signs:** Unstyled Fumadocs components; layout elements missing; sidebar has no styling.

### Pitfall 7: Documentation Getting Stale
**What goes wrong:** Documentation describes features that have changed, leading to user confusion.
**Why it happens:** Documentation lives separate from feature code.
**How to avoid:** Include documentation updates as part of feature plan tasks. Add frontmatter `last_updated` dates. Review content quarterly.
**Warning signs:** User reports of incorrect docs; frontmatter dates more than 3 months old.

## Code Examples

### next.config.ts Update for Fumadocs MDX
```typescript
// Source: https://fumadocs.dev/docs/mdx/next
// apps/web-portal/next.config.ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const securityHeaders = [
  // ... existing security headers unchanged ...
];

const nextConfig: NextConfig = {
  output: 'standalone',
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

const withMDX = createMDX();

export default withMDX(nextConfig);
```

### Tailwind CSS Setup for Docs Route Group
```css
/* This goes in the (docs)/layout.tsx as an import, OR in a separate docs.css file */
/* The key CSS additions for Fumadocs (add to globals.css if using root-level approach) */
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
@source '../node_modules/fumadocs-ui/dist/**/*.js';
```

### Custom Brand Theming for Docs
```css
/* Override Fumadocs CSS variables to match brand */
/* Add after the Fumadocs CSS imports */
:root {
  /* Match the warm cream background */
  --color-fd-background: oklch(0.995 0.005 85);
  --color-fd-foreground: oklch(0.145 0 0);
  /* Match the blue-indigo gradient for primary */
  --color-fd-primary: oklch(0.55 0.18 250);
  --color-fd-primary-foreground: oklch(0.985 0 0);
}
```

### tsconfig.json Path Alias Addition
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/.source": ["./.source"]
    }
  }
}
```

### Package.json Script Addition
```json
{
  "scripts": {
    "postinstall": "fumadocs-mdx",
    "dev": "next dev --port 3001",
    "build": "next build"
  }
}
```

### .gitignore Addition
```
# Fumadocs MDX generated files
.source/
```

### Example MDX Article with Fumadocs Components
```mdx
---
title: Watching Conversations
description: Learn how to use /watch and /unwatch to monitor Slack conversations
---

import { Callout } from 'fumadocs-ui/components/callout'
import { Steps, Step } from 'fumadocs-ui/components/steps'

# Watching Conversations

Speak for Me monitors specific Slack conversations and automatically suggests
responses when someone sends a message that may need your attention.

<Callout type="info">
  Suggestions are delivered as ephemeral messages -- only you can see them.
</Callout>

## How to Start Watching

<Steps>
  <Step>
    Open the Slack channel or DM you want to monitor.
  </Step>
  <Step>
    Type `/watch` and press Enter.
  </Step>
  <Step>
    You will see a confirmation message. The bot will now suggest responses
    when new messages arrive in this conversation.
  </Step>
</Steps>

## What Triggers a Suggestion?

| Trigger | Description |
|---------|-------------|
| Someone replies to your message | In any watched conversation |
| You are @mentioned | In any watched conversation |
| New message in active thread | Threads you have participated in |

<Callout type="warn">
  Use the **Conversations** page in the web portal to see all your
  watched conversations in one place.
</Callout>
```

### Fumadocs Built-in MDX Components Usage
```typescript
// In page.tsx, pass default components to MDX body
import defaultMdxComponents from 'fumadocs-ui/mdx';

// These are automatically available in MDX files:
// - Callout (info, warning, error types)
// - Steps / Step
// - Tabs / Tab
// - Cards / Card
// - Accordion
// - Files (file tree display)
// - Zoomable Image
// - Code blocks with syntax highlighting (Shiki)

const MDX = page.data.body;
<MDX components={{ ...defaultMdxComponents }} />;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `@next/mdx` + custom components | Fumadocs framework | 2024-2025 | Eliminates ~12 custom components; provides search, sidebar, TOC, breadcrumbs, pagination out-of-box |
| `mdx-components.tsx` file convention | Explicit `components` prop on MDX body | Fumadocs MDX v10 (2025) | More explicit; no magic file convention; components passed directly to `<MDX components={...} />` |
| `tailwind.config.js` with `createPreset()` | CSS imports `fumadocs-ui/css/preset.css` | Fumadocs v15 (2025) | Tailwind v4 CSS-first approach; no JS config needed for Fumadocs styling |
| `createMDXSource(docs, meta)` import from `.source` | `docs.toFumadocsSource()` method | Fumadocs v16 (2025) | Simplified API; collections have built-in conversion method |
| `fumadocs-core/server` catch-all imports | Specialized module imports | Fumadocs v16 (2025) | `getTableOfContents` from `fumadocs-core/content/toc`, page tree from `fumadocs-core/page-tree` |
| FlexSearch client-side search | Orama-based search via `createFromSource()` | Fumadocs built-in | Zero-config search; structured data indexing; search dialog UI included |
| `next-mdx-remote` for local files | `fumadocs-mdx` collections | 2025 | Type-safe, build-time validated, generates `.source` directory |

**Deprecated/outdated:**
- `next-mdx-remote`: Poorly maintained. Fumadocs MDX is the replacement for local MDX content.
- `contentlayer`: Abandoned in 2023. Fumadocs MDX is the spiritual successor.
- `mdx-components.tsx`: Not used by Fumadocs MDX v10+.
- `fumadocs-core/sidebar`: Removed in v16. Use pre-built `DocsLayout` from `fumadocs-ui`.
- `createMetadataImage`: Removed in v16. Use Next.js Metadata API directly.
- `steps`/`step` CSS classes: Renamed to `fd-steps`/`fd-step` to avoid conflicts.

## Open Questions

1. **Exact CSS scoping with route groups**
   - What we know: Route groups create separate layouts. Fumadocs CSS can be imported only in the docs root layout. The `fd-` prefix prevents variable collision.
   - What's unclear: Whether the `@source` directive for Tailwind needs to be in the global CSS or can be scoped to a docs-only CSS file. Since Tailwind processes all CSS files together, it likely needs to be in the main `globals.css`.
   - Recommendation: Add the `@source` directive to `globals.css` (it only tells Tailwind to scan for classes -- does not inject styles). Import the Fumadocs CSS files in the `(docs)/layout.tsx`. Test that existing pages are unaffected.

2. **Route group migration complexity**
   - What we know: All existing app pages must move into a `(main)` route group. This is a file reorganization, not a code change.
   - What's unclear: Whether the existing `(auth)` route group nests cleanly inside `(main)`. Also, API routes at `app/api/` may need to stay at the top level or move.
   - Recommendation: Plan the migration carefully. API routes should likely stay at `app/api/` (outside both route groups) since they are shared. The `(auth)` group moves inside `(main)` as `(main)/(auth)/`.

3. **Fumadocs MDX `postinstall` in monorepo**
   - What we know: The `postinstall` script runs `fumadocs-mdx` to generate the `.source` directory. In a monorepo, this needs to run in the web-portal workspace.
   - What's unclear: Whether `fumadocs-mdx` postinstall works when run from the root `npm install` vs workspace-specific install. The `source.config.ts` must be findable.
   - Recommendation: Add postinstall to `apps/web-portal/package.json`. Verify it runs correctly with `npm install` from the monorepo root. May need `cd apps/web-portal && fumadocs-mdx` wrapper.

4. **Exact Fumadocs version compatibility with Next.js 16.1.5**
   - What we know: Fumadocs v16 requires React 19.2+ (project has 19.2.3). The template uses Next.js 16.0.0. The project has Next.js 16.1.5.
   - What's unclear: Whether 16.1.5 introduces any incompatibilities. Highly unlikely since it is a patch version.
   - Recommendation: Install and test. This is LOW risk.

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
- [Fumadocs Official Documentation](https://www.fumadocs.dev/docs/mdx) - MDX getting started, source config, collections
- [Fumadocs UI Layouts](https://www.fumadocs.dev/docs/ui/layouts/docs) - DocsLayout, DocsPage component APIs
- [Fumadocs Themes](https://www.fumadocs.dev/docs/ui/theme) - CSS variable customization, Tailwind v4 setup
- [Fumadocs Search (Orama)](https://www.fumadocs.dev/docs/headless/search/orama) - Built-in search API setup
- [Fumadocs Page Conventions](https://www.fumadocs.dev/docs/ui/page-conventions) - meta.json, page tree, sidebar ordering
- [Fumadocs GitHub Repository](https://github.com/fuma-nama/fumadocs) - Source code, templates, examples
- [Fumadocs UI Template](https://github.com/fuma-nama/fumadocs-ui-template) - Official starter template structure
- [Fumadocs Root Provider](https://www.fumadocs.dev/docs/ui/layouts/root-provider) - Provider configuration, scoping
- [npm: fumadocs-core@16.x, fumadocs-ui@16.x, fumadocs-mdx@14.x](https://www.npmjs.com/package/fumadocs-core) - Current package versions

### Secondary (MEDIUM confidence)
- [Fumadocs v15 Blog Post](https://www.fumadocs.dev/blog/v15) - Tailwind CSS v4 migration details
- [Fumadocs v16 Blog Post](https://www.fumadocs.dev/blog/v16) - v16 breaking changes, new APIs
- [Fumadocs MDX v10 Summary](https://fumadocs.dev/blog/mdx-v10-summary) - mdx-components.tsx removal, collections system
- [Fumadocs + shadcn Discussion](https://github.com/fuma-nama/fumadocs/discussions/1171) - CSS variable conflict resolution
- [Fumadocs Separate Root Layout Discussion](https://github.com/fuma-nama/fumadocs/discussions/860) - Route group approach
- [Vinzius: Fumadocs Tips for Existing Projects](https://www.vinzius.com/post/fumadocs-tips-converting-existing-nextjs-project/) - Practical integration tips
- [Daniel Fullstack: Setup Fumadocs in 5 Minutes](https://www.danielfullstack.com/article/setup-fumadocs-with-nextjs-in-5-minutes) - Step-by-step setup guide

### Tertiary (LOW confidence)
- Fumadocs workspace support for monorepos -- documented but not battle-tested for this specific monorepo structure
- Exact CSS scoping behavior with route groups + Tailwind v4 `@source` directive -- needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official npm packages, well-documented versions, verified compatibility
- Architecture: HIGH - Based on official Fumadocs examples, template structure, and community discussions about existing app integration
- Pitfalls: HIGH - Based on official docs, GitHub discussions, community blog posts, and project-specific analysis
- Content plan: MEDIUM - Scope estimated from success criteria; actual article count depends on feature complexity
- CSS/Theme integration: MEDIUM - Fumadocs fd- prefix and route group scoping are well-documented, but the exact interplay with this project's Tailwind v4 setup needs validation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Fumadocs v16 is stable, no rapid breaking changes expected)
