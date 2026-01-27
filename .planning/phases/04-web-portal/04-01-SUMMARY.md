---
phase: 04-web-portal
plan: 01
subsystem: ui
tags: [next.js, shadcn, tailwind, react, typescript, monorepo]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Database package with Drizzle ORM and schema
provides:
  - Next.js 15 web application in monorepo
  - shadcn/ui component library with 8 core components
  - Tailwind CSS styling foundation
  - Cross-package imports from database package
affects: [04-web-portal, ui, frontend]

# Tech tracking
tech-stack:
  added: [next.js@16.1.5, react@19.2.3, shadcn/ui, tailwindcss@4, sonner, react-hook-form, jose, lucide-react]
  patterns: [App Router, Server Components, shadcn/ui component pattern, monorepo workspace integration]

key-files:
  created:
    - apps/web-portal/package.json
    - apps/web-portal/tsconfig.json
    - apps/web-portal/next.config.ts
    - apps/web-portal/components.json
    - apps/web-portal/app/layout.tsx
    - apps/web-portal/app/page.tsx
    - apps/web-portal/app/globals.css
    - apps/web-portal/lib/utils.ts
    - apps/web-portal/components/ui/button.tsx
    - apps/web-portal/components/ui/form.tsx
    - apps/web-portal/components/ui/input.tsx
    - apps/web-portal/components/ui/label.tsx
    - apps/web-portal/components/ui/card.tsx
    - apps/web-portal/components/ui/select.tsx
    - apps/web-portal/components/ui/textarea.tsx
    - apps/web-portal/components/ui/sonner.tsx
  modified:
    - turbo.json
    - packages/database/package.json
    - package-lock.json

key-decisions:
  - "Port 3001 for web-portal dev server to avoid conflict with slack-backend (port 3000)"
  - "New York style for shadcn/ui with neutral base color for professional appearance"
  - "Sonner for toast notifications (toast component deprecated)"
  - "Database package exports compiled dist files for Next.js Turbopack compatibility"
  - "Standalone output mode for future Docker deployment"

patterns-established:
  - "shadcn/ui components in components/ui/ directory"
  - "Path aliases via @/* for clean imports"
  - "cn() utility for class merging with tailwind-merge and clsx"
  - "Database package exports via dist/ for cross-app compatibility"

# Metrics
duration: 5min
completed: 2026-01-27
---

# Phase 04 Plan 01: Next.js Foundation Summary

**Next.js 15 web portal with shadcn/ui component library, Tailwind CSS v4, and monorepo integration enabling database package imports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-27T09:58:03Z
- **Completed:** 2026-01-27T10:03:24Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Next.js 15 app scaffolded with TypeScript, App Router, and Tailwind CSS v4
- shadcn/ui initialized with 8 core components (button, form, input, label, card, select, textarea, sonner)
- Monorepo workspace integration with cross-package imports from database package
- Development server configured on port 3001 to avoid slack-backend port conflict
- Standalone output mode configured for future Docker deployment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js 15 app in monorepo** - `d9883e5` (feat)
2. **Task 2: Initialize shadcn/ui with core components** - `afff7f3` (feat)
3. **Task 3: Update turbo.json and verify monorepo integration** - `4da6bd1` (fix)

## Files Created/Modified

### Created
- `apps/web-portal/package.json` - Next.js project configuration with workspace dependencies
- `apps/web-portal/tsconfig.json` - TypeScript config with path aliases
- `apps/web-portal/next.config.ts` - Next.js config with standalone output and transpilePackages
- `apps/web-portal/components.json` - shadcn/ui configuration (New York style, neutral colors)
- `apps/web-portal/app/layout.tsx` - Root layout with fonts, metadata, and Sonner toaster
- `apps/web-portal/app/page.tsx` - Home page with Next.js starter content
- `apps/web-portal/app/globals.css` - Tailwind base styles and CSS variables
- `apps/web-portal/lib/utils.ts` - cn() helper for class name merging
- `apps/web-portal/components/ui/button.tsx` - Button component with variants
- `apps/web-portal/components/ui/form.tsx` - Form components with react-hook-form integration
- `apps/web-portal/components/ui/input.tsx` - Input component
- `apps/web-portal/components/ui/label.tsx` - Label component
- `apps/web-portal/components/ui/card.tsx` - Card components (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- `apps/web-portal/components/ui/select.tsx` - Select dropdown component
- `apps/web-portal/components/ui/textarea.tsx` - Textarea component
- `apps/web-portal/components/ui/sonner.tsx` - Toast notification component

### Modified
- `turbo.json` - Added .next/** to build outputs for proper caching
- `packages/database/package.json` - Changed exports from TypeScript source to compiled dist files
- `package-lock.json` - Added dependencies for web-portal workspace

## Decisions Made

**1. Port 3001 for web-portal dev server**
- Rationale: Avoids conflict with slack-backend running on default port 3000
- Implementation: Updated dev script to `next dev --port 3001`

**2. New York style for shadcn/ui**
- Rationale: More polished, professional appearance compared to default style
- Configuration: components.json with neutral base color and CSS variables

**3. Sonner instead of deprecated toast component**
- Rationale: shadcn/ui deprecated toast in favor of sonner
- Implementation: Added sonner component, included Toaster in root layout

**4. Database package exports compiled dist files**
- Rationale: Next.js Turbopack cannot resolve .js extensions in TypeScript source imports
- Impact: Enables proper module resolution for workspace package imports
- Files: Changed main/types/exports in packages/database/package.json to point to dist/

**5. Standalone output mode**
- Rationale: Prepares for Docker deployment in Phase 5
- Configuration: Added `output: 'standalone'` to next.config.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed database package module resolution**
- **Found during:** Task 3 (Verify monorepo integration)
- **Issue:** Next.js Turbopack could not resolve imports from database package when it exported TypeScript source files with .js extensions
- **Fix:** Updated packages/database/package.json to export compiled dist files instead of src TypeScript files
- **Files modified:** packages/database/package.json
- **Verification:** `npm run build --workspace=web-portal` succeeded with database import test
- **Committed in:** 4da6bd1

**2. [Rule 3 - Blocking] Updated turbo.json for Next.js caching**
- **Found during:** Task 3 (Verify monorepo integration)
- **Issue:** turbo.json outputs only included dist/** but Next.js builds to .next/
- **Fix:** Added .next/** and !.next/cache/** to build task outputs
- **Files modified:** turbo.json
- **Verification:** Full monorepo build completes successfully with proper caching
- **Committed in:** 4da6bd1

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for Next.js integration with monorepo workspace packages. No scope creep.

## Issues Encountered

**1. Sonner instead of toast**
- **Issue:** Attempted to add toast component but shadcn/ui returned error that toast is deprecated
- **Resolution:** Used sonner component instead as recommended by shadcn/ui
- **Impact:** None - sonner provides equivalent toast notification functionality

**2. Database package TypeScript source exports incompatible with Next.js**
- **Issue:** Database package exported TypeScript source files with .js extensions, but Next.js Turbopack couldn't resolve them
- **Root cause:** ESM convention uses .js extensions in imports even for .ts files, which works when TypeScript transpiles but not when Next.js imports TypeScript source directly
- **Resolution:** Updated database package to export compiled dist files
- **Impact:** Database package now requires build step before use (already in turbo pipeline)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 04 Plan 02 (Auth Integration):**
- Next.js app structure in place
- Component library ready for building auth UI
- Database package accessible from web-portal
- Build and dev pipelines working

**No blockers or concerns.**

---
*Phase: 04-web-portal*
*Completed: 2026-01-27*
