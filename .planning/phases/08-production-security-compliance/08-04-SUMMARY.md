---
phase: 08
plan: 04
subsystem: legal-compliance
tags: [privacy-policy, terms-of-service, gdpr, footer, legal]

dependency_graph:
  requires: []
  provides:
    - Privacy Policy page at /privacy
    - Terms of Service page at /terms
    - Footer component with legal links
  affects:
    - User trust and legal compliance
    - SEO (legal pages add credibility)

tech_stack:
  added: []
  patterns:
    - Server-rendered legal pages with metadata
    - Reusable Footer component

file_tracking:
  key_files:
    created:
      - apps/web-portal/app/privacy/page.tsx
      - apps/web-portal/app/terms/page.tsx
      - apps/web-portal/components/footer.tsx
    modified:
      - apps/web-portal/components/landing/landing-page-content.tsx

decisions:
  - id: d-0804-01
    description: Server-rendered legal pages for SEO
    context: Privacy and Terms pages need to be crawlable
    alternatives: [Client-rendered with hydration]
    rationale: Server components ensure full content in initial HTML

metrics:
  duration: 4m 5s
  completed: 2026-02-01
---

# Phase 8 Plan 04: Privacy Policy and Terms of Service Summary

**One-liner:** GDPR-compliant Privacy Policy and Terms of Service pages with Footer component linking to both from landing page

## What Was Built

### 1. Privacy Policy Page (`/privacy`)
- Comprehensive GDPR-compliant privacy policy
- Covers all data types collected (Slack, user, message, style, usage, Google integration)
- Documents data usage, storage, retention, and security practices
- Lists third-party services (Slack, Anthropic, Stripe, Google) with links to their privacy policies
- Explains user rights under GDPR with instructions for exercising them
- Contact information for privacy inquiries

### 2. Terms of Service Page (`/terms`)
- Complete terms covering service description and eligibility
- Acceptable use policy prohibiting harassment, spam, and illegal activities
- AI-generated content disclaimer emphasizing user responsibility
- Intellectual property rights (ours and users')
- Payment terms including trials, billing, and cancellation
- Limitation of liability and indemnification clauses
- Termination conditions
- Governing law (Malta jurisdiction)

### 3. Footer Component
- Standalone reusable component at `components/footer.tsx`
- Links to Privacy Policy, Terms of Service, Pricing, FAQ, Support
- Dynamic copyright year
- Consistent branding with logo

### 4. Landing Page Integration
- Replaced inline footer with Footer component
- Links verified working

## Technical Details

### File Structure
```
apps/web-portal/
  app/
    privacy/
      page.tsx       # 237 lines - Privacy Policy
    terms/
      page.tsx       # 289 lines - Terms of Service
  components/
    footer.tsx       # 54 lines - Reusable footer
    landing/
      landing-page-content.tsx  # Updated to use Footer
```

### Metadata
Both legal pages export proper Next.js metadata:
- `title`: Uses template from layout (`Privacy Policy | Speak for Me`)
- `description`: SEO-friendly descriptions

### Styling
- Clean typography with Tailwind prose classes
- Consistent heading hierarchy (h1 > h2 > h3)
- External links with `target="_blank" rel="noopener noreferrer"`
- Internal links use Next.js Link component
- Back to Home link at bottom of each page

## Commits

| Hash | Type | Message |
|------|------|---------|
| 544a6e4 | feat | add Privacy Policy page |
| 3b8195f | feat | add Terms of Service page |
| 0851475 | feat | add Footer component with legal links |

## Verification Results

- [x] Build succeeds with new pages in route list
- [x] `/privacy` renders Privacy Policy with proper title
- [x] `/terms` renders Terms of Service with proper title
- [x] Footer visible on landing page
- [x] Privacy Policy link navigates correctly
- [x] Terms of Service link navigates correctly
- [x] Dashboard pages do NOT show footer (they have sidebar)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Legal compliance foundations are in place:**
- Privacy Policy ready for production
- Terms of Service ready for production
- Footer provides consistent legal links across public pages

**Recommended follow-ups:**
- Review legal content with actual legal counsel
- Add cookie consent banner if not already present (exists via CookieConsentBanner component)
- Update "Last updated" dates when making policy changes
