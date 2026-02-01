---
phase: 07-monetization-pricing
plan: 01
subsystem: ui, seo
tags: [json-ld, schema-dts, pricing, seo, structured-data]

# Dependency graph
requires:
  - phase: 04-web-portal
    provides: Next.js app structure, UI components
provides:
  - Public pricing page with Starter ($10) and Pro ($15) plans
  - JSON-LD infrastructure for SEO (SoftwareApplication, Organization, Speakable)
  - Reusable JsonLd component with XSS protection
  - Pricing table component with feature comparison
affects: [07-02, 07-03, marketing, seo]

# Tech tracking
tech-stack:
  added: [schema-dts]
  patterns: [json-ld-injection, speakable-markup]

key-files:
  created:
    - apps/web-portal/lib/seo/schemas.ts
    - apps/web-portal/components/seo/json-ld.tsx
    - apps/web-portal/components/pricing/pricing-table.tsx
    - apps/web-portal/app/pricing/page.tsx
  modified: []

key-decisions:
  - "schema-dts for TypeScript JSON-LD types"
  - "XSS protection via Unicode escaping in JsonLd component"
  - "Speakable schema for voice assistant headline markup"

patterns-established:
  - "JsonLd component for structured data injection"
  - "createSpeakableSchema factory function for voice accessibility"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 7 Plan 1: Public Pricing Page and SEO Schemas Summary

**Public pricing page with Starter ($10) and Pro ($15) plans, JSON-LD schemas for SoftwareApplication, Organization, and Speakable markup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T10:51:00Z
- **Completed:** 2026-02-01T10:55:00Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Created JSON-LD schema infrastructure with SoftwareApplication, Organization, FAQ, and Speakable schemas
- Built pricing page with plan comparison (Starter $10, Pro $15 per seat/month)
- Implemented XSS-safe JsonLd component for structured data injection
- Added Speakable markup for voice assistant accessibility on headline content

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JSON-LD utility component and schema definitions** - `683c94a` (feat)
2. **Task 2: Create pricing table component and pricing page** - `9fa8c8d` (feat, part of 07-02 parallel execution)

## Files Created

- `apps/web-portal/lib/seo/schemas.ts` - JSON-LD schema definitions (SoftwareApplication, Organization, FAQ, Speakable)
- `apps/web-portal/components/seo/json-ld.tsx` - XSS-safe JSON-LD script injection component
- `apps/web-portal/components/pricing/pricing-table.tsx` - Pricing cards with Starter/Pro plans
- `apps/web-portal/app/pricing/page.tsx` - Public pricing page with JSON-LD schemas

## Decisions Made

- **schema-dts package**: Official TypeScript types for schema.org JSON-LD structures
- **XSS protection via Unicode escaping**: `JSON.stringify(data).replace(/</g, '\\u003c')` prevents script tag injection
- **Speakable factory function**: `createSpeakableSchema(selectors)` allows flexible voice assistant markup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- JSON-LD infrastructure ready for FAQ schema population in Plan 02
- Pricing page ready for Stripe checkout integration in Plan 03
- Organization schema can be extended with social links when available

---
*Phase: 07-monetization-pricing*
*Completed: 2026-02-01*
