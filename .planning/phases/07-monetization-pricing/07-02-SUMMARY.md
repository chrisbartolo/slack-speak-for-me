---
phase: 07-monetization-pricing
plan: 02
subsystem: ui
tags: [seo, json-ld, faq, sitemap, robots, next.js]

# Dependency graph
requires:
  - phase: 07-01
    provides: JSON-LD schema infrastructure and schema-dts library
provides:
  - Landing page FAQ section with FAQPage schema
  - Dynamic sitemap.xml generation
  - Dynamic robots.txt generation
affects: [landing-page, seo, google-search]

# Tech tracking
tech-stack:
  added: []
  patterns: [Next.js Script component for JSON-LD, MetadataRoute.Sitemap, MetadataRoute.Robots]

key-files:
  created:
    - apps/web-portal/app/sitemap.ts
    - apps/web-portal/app/robots.ts
  modified:
    - apps/web-portal/app/page.tsx
    - apps/web-portal/lib/seo/schemas.ts

key-decisions:
  - "Interactive FAQ accordion vs static list for better UX"
  - "Next.js Script component for JSON-LD in client component"
  - "Static sitemap generation with weekly/monthly/yearly change frequencies"

patterns-established:
  - "FAQ schema with faqItems array for both display and JSON-LD"
  - "MetadataRoute types for sitemap.ts and robots.ts"

# Metrics
duration: 2min
completed: 2026-02-01
---

# Phase 07 Plan 02: Landing Page SEO Summary

**FAQ section with FAQPage JSON-LD schema, dynamic sitemap.xml and robots.txt for SEO**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-01T10:50:22Z
- **Completed:** 2026-02-01T10:52:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Interactive FAQ accordion with 6 questions covering product, privacy, trial, pricing, and cancellation
- FAQPage JSON-LD schema for Google rich results
- Dynamic sitemap.xml with /, /pricing, /login pages
- robots.txt allowing public pages and disallowing /dashboard, /admin, /api, /callback, /install

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FAQ section with FAQPage schema** - `d2a69ad` (feat)
2. **Task 2: Create sitemap.ts and robots.ts** - `9fa8c8d` (feat)

## Files Created/Modified
- `apps/web-portal/app/page.tsx` - Added FAQSection component and JSON-LD script
- `apps/web-portal/lib/seo/schemas.ts` - Added faqItems array and populated faqSchema
- `apps/web-portal/app/sitemap.ts` - Dynamic sitemap generation
- `apps/web-portal/app/robots.ts` - Dynamic robots.txt with allow/disallow rules

## Decisions Made
- Used interactive accordion for FAQ section for better UX (collapsible answers)
- Used Next.js Script component for JSON-LD in client component (page.tsx is 'use client')
- Set change frequencies: / weekly, /pricing monthly, /login yearly based on expected update frequency
- Disallowed /callback and /install in robots.txt as they are transient OAuth routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEO infrastructure complete with structured data, sitemap, and robots.txt
- Ready for Google Search Console verification and indexing
- Ready for further SEO enhancements (meta descriptions, OpenGraph)

---
*Phase: 07-monetization-pricing*
*Completed: 2026-02-01*
