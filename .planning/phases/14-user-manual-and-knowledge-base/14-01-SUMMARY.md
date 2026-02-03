---
phase: 14-user-manual-and-knowledge-base
plan: 01
subsystem: ui
tags: [fumadocs, mdx, documentation, next.js, tailwind-v4, orama-search]

# Dependency graph
requires:
  - phase: 04-web-portal
    provides: Next.js web portal with App Router, Tailwind v4, shadcn/ui
provides:
  - Fumadocs documentation infrastructure at /docs
  - MDX content pipeline with build-time compilation
  - Orama-based search API at /docs/api/search
  - Route group architecture scoping Fumadocs to (docs) group
  - Content directory structure at content/docs/
affects: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07]

# Tech tracking
tech-stack:
  added: [fumadocs-core@16.5.0, fumadocs-ui@16.5.0, fumadocs-mdx@14.2.6, @types/mdx@2.0.13]
  patterns: [route-group-scoped-provider, fumadocs-mdx-source-config, css-imports-in-globals-for-tailwind-v4]

key-files:
  created:
    - apps/web-portal/source.config.ts
    - apps/web-portal/lib/source.ts
    - apps/web-portal/app/(docs)/layout.tsx
    - apps/web-portal/app/(docs)/docs/layout.tsx
    - apps/web-portal/app/(docs)/docs/[[...slug]]/page.tsx
    - apps/web-portal/app/(docs)/docs/api/search/route.ts
    - apps/web-portal/content/docs/index.mdx
    - apps/web-portal/content/docs/meta.json
  modified:
    - apps/web-portal/package.json
    - apps/web-portal/next.config.ts
    - apps/web-portal/tsconfig.json
    - apps/web-portal/app/globals.css
    - apps/web-portal/middleware.ts
    - .gitignore

key-decisions:
  - "Fumadocs CSS imports in globals.css not in (docs)/layout.tsx -- Tailwind v4 requires @apply directives to be in the same PostCSS pipeline as @import tailwindcss"
  - "Import from @/.source/server not @/.source -- Turbopack needs explicit file reference since .source has no index file"
  - "RootProvider in (docs)/layout.tsx without html/body -- root layout.tsx already provides those tags"
  - "zodResolver as any cast for Zod v4 bridge compatibility -- fumadocs-core depends on zod@4 which hoists to root and breaks @hookform/resolvers type expectations"

patterns-established:
  - "Route group scoping: Fumadocs provider and layouts isolated in app/(docs)/ without affecting existing routes"
  - "Content directory convention: MDX content in content/docs/ with meta.json for sidebar ordering"
  - "Source config at workspace root: source.config.ts defines collections, lib/source.ts creates loader"

# Metrics
duration: 9min
completed: 2026-02-03
---

# Phase 14 Plan 01: Fumadocs Infrastructure Summary

**Fumadocs v16 documentation framework integrated with route group scoping, MDX pipeline, Orama search, and sidebar navigation at /docs**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-03T09:11:17Z
- **Completed:** 2026-02-03T09:20:23Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Fumadocs v16 installed and configured with createMDX wrapping Next.js config
- /docs route renders documentation index page with sidebar navigation and search
- All existing routes (/, /dashboard, /pricing, /admin) remain completely unaffected
- Build passes successfully with SSG for docs pages and dynamic search API

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Fumadocs packages and configure build pipeline** - `be28ce6` (feat)
2. **Task 2: Create docs route group with layouts, dynamic page, and search** - `b141ea6` (feat)

## Files Created/Modified
- `apps/web-portal/source.config.ts` - Fumadocs MDX collection definition with content/docs directory
- `apps/web-portal/lib/source.ts` - Source loader with /docs base URL
- `apps/web-portal/app/(docs)/layout.tsx` - RootProvider scoped to docs route group
- `apps/web-portal/app/(docs)/docs/layout.tsx` - DocsLayout with sidebar and "Speak for Me Docs" title
- `apps/web-portal/app/(docs)/docs/[[...slug]]/page.tsx` - Dynamic MDX page renderer with TOC, title, description
- `apps/web-portal/app/(docs)/docs/api/search/route.ts` - Orama search API with English language support
- `apps/web-portal/content/docs/index.mdx` - Documentation landing page with quick links
- `apps/web-portal/content/docs/meta.json` - Sidebar ordering with section separators
- `apps/web-portal/next.config.ts` - Wrapped with createMDX from fumadocs-mdx/next
- `apps/web-portal/tsconfig.json` - Added @/.source path alias and .source include
- `apps/web-portal/app/globals.css` - Added Fumadocs CSS imports for Tailwind v4 processing
- `apps/web-portal/middleware.ts` - Added /docs to public routes
- `apps/web-portal/package.json` - Added fumadocs packages and postinstall script
- `.gitignore` - Added .source/ to exclusions

## Decisions Made
- **Fumadocs CSS in globals.css:** Tailwind v4 requires `@apply` directives to be processed in the same PostCSS pipeline as `@import "tailwindcss"`. Moving Fumadocs CSS imports from the (docs) layout to globals.css resolves "Cannot apply unknown utility class" errors.
- **Import path @/.source/server:** The fumadocs-mdx codegen creates `server.ts`, `dynamic.ts`, and `browser.ts` in `.source/` but no index file. Turbopack cannot resolve a bare directory import, so `@/.source/server` is used instead of the documented `@/.source`.
- **zodResolver as any cast:** Installing fumadocs-core hoists zod@4.3.6 to root node_modules. The `@hookform/resolvers` package (also hoisted to root) picks up zod v4 types, creating incompatibility with Zod v3 schemas. Type cast resolves this without changing runtime behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fumadocs CSS imports moved from layout to globals.css**
- **Found during:** Task 2 (build verification)
- **Issue:** `fumadocs-ui/css/preset.css` uses `@apply top-0` which fails when imported in a TSX layout file because Tailwind v4 requires all CSS to be processed in the same PostCSS context
- **Fix:** Moved `@import "fumadocs-ui/css/neutral.css"` and `@import "fumadocs-ui/css/preset.css"` from `(docs)/layout.tsx` to `globals.css` where Tailwind processes them
- **Files modified:** `apps/web-portal/app/globals.css`, `apps/web-portal/app/(docs)/layout.tsx`
- **Verification:** Build passes, Fumadocs styling renders correctly
- **Committed in:** b141ea6 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed @/.source import path for Turbopack**
- **Found during:** Task 2 (build verification)
- **Issue:** Turbopack cannot resolve `@/.source` as a directory import because `.source/` has no index file
- **Fix:** Changed import to `@/.source/server` which directly references the generated `server.ts` file
- **Files modified:** `apps/web-portal/lib/source.ts`
- **Verification:** Build passes, source loader works correctly
- **Committed in:** b141ea6 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed zodResolver type incompatibility with Zod v4 bridge**
- **Found during:** Task 2 (build verification)
- **Issue:** fumadocs-core depends on zod@4.3.6 which gets hoisted to root node_modules. `@hookform/resolvers` resolves zod from root, causing type mismatch with Zod v3 schemas used in forms
- **Fix:** Added `as any` type cast to zodResolver calls in 3 form components
- **Files modified:** `components/forms/person-context-form.tsx`, `components/forms/style-preferences-form.tsx`, `components/forms/report-settings-form.tsx`
- **Verification:** Build passes, form validation works at runtime
- **Committed in:** b141ea6 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for build to pass. No scope creep.

## Issues Encountered
- Fumadocs v16 codegen does not create index.ts in .source directory, contrary to documentation suggesting `@/.source` bare imports work
- npm workspace hoisting causes zod version conflict when fumadocs-core (zod@4) and web-portal (zod@3) coexist
- Tailwind v4's CSS-first architecture requires all `@apply` directives to be in the PostCSS pipeline, breaking the recommended pattern of importing Fumadocs CSS in layout components

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Documentation infrastructure is complete and ready for content authoring
- Content can be added to `content/docs/` as `.mdx` files with `meta.json` for sidebar ordering
- Fumadocs components (Callout, Steps, Tabs, Cards) available for rich documentation content
- Search API operational at `/docs/api/search`

---
*Phase: 14-user-manual-and-knowledge-base*
*Completed: 2026-02-03*
