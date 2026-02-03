# Production Readiness Checklist

## 1. Automated Test Coverage

### Current Status: NEEDS WORK

**Test Results:** 87 failed, 240 passed (73% pass rate)
**Coverage:** ~11% (below 90% threshold)

### Files WITH Tests (20 files)
- Services: ai, context, report-generator, suggestion-delivery, watch
- Handlers: app-mention, message-reply, copy/dismiss/refine-suggestion, watch, help-me-respond, refinement-modal
- OAuth: installation-store
- Jobs: schedulers
- Integration: database, job-queue
- E2E: app-mention, suggestion-flow

### Critical Gaps (Phase 5 - NO TESTS)

| File | Priority | Tests Needed |
|------|----------|--------------|
| `oauth/google-oauth.ts` | CRITICAL | Token exchange, refresh, state validation |
| `services/google-sheets.ts` | CRITICAL | Sheet read/write, error handling |
| `handlers/events/workflow-submission.ts` | HIGH | Bot detection, submission parsing |
| `handlers/commands/generate-report.ts` | HIGH | Command parsing, queue trigger |
| `handlers/actions/report-actions.ts` | HIGH | Copy/Refine button handlers |
| `handlers/views/report-refinement-modal.ts` | HIGH | Modal display, submission |

### Phase 3 Personalization (NO TESTS)
- `services/personalization/consentService.ts`
- `services/personalization/preferencesStore.ts`
- `services/personalization/styleContextBuilder.ts`
- `services/personalization/feedbackTracker.ts`
- `services/personalization/historyAnalyzer.ts`

### Immediate Actions
1. Fix failing tests in `refinement-modal.test.ts` (mock setup issue)
2. Add Phase 5 test coverage before production
3. Add Phase 3 personalization tests

---

## 2. OWASP Security Review

### Summary: ~~2 Critical~~, ~~2 High~~, 15 Medium, 2 Low findings

### CRITICAL Issues - FIXED (2026-01-30)

#### 1. ✅ FIXED: Test Routes Exposed Without Authentication
**File:** `routes/test.ts`
**Status:** Test routes are disabled in production via `NODE_ENV` check
**Verification:** Routes return empty array when `NODE_ENV=production`

#### 2. ✅ FIXED: Missing CSRF Protection in OAuth State
**File:** `oauth/google-oauth.ts`
**Status:** Implemented HMAC-signed state with 10-minute expiration
**Implementation:** `generateSecureState()` and `validateSecureState()` with:
- Base64URL-encoded JSON payload (workspaceId, userId, timestamp, nonce)
- HMAC-SHA256 signature using `SLACK_STATE_SECRET`
- 10-minute expiration check

### HIGH Issues - FIXED (2026-01-30)

#### 3. ✅ FIXED: Insufficient RLS Policy Coverage
**Status:** Added RLS policies to all workspace-scoped tables
**Migration:** `0004_complete_rls_policies.sql`
**Tables covered:** installations, report_settings, google_integrations, workflow_config

#### 4. ✅ FIXED: Weak OAuth State Parameter
See Critical #2 above.

#### 5. ✅ FIXED: SQL Injection in RLS Context Setting
**File:** `packages/database/src/client.ts`
**Status:** Added UUID format validation before SQL execution
**Implementation:** `isValidUUID()` check prevents malicious workspace IDs

### MEDIUM Issues (Fix Before Scale)

| Issue | File | Status |
|-------|------|--------|
| Rate limiting on test endpoints | routes/test.ts | Low priority (routes disabled in prod) |
| SSRF in response URL | jobs/workers.ts | Validate Slack domain |
| Verbose health endpoint | handlers/health.ts | Reduce info in production |
| Missing CORS headers | app.ts | Add explicit CORS config |
| Console.log usage | Various | Replace with logger |
| No audit logging | Services | Add audit log table |
| ~~SQL template literal~~ | ~~database/client.ts~~ | ✅ FIXED - UUID validation |

### Positive Security Findings
- ✅ AES-256-GCM encryption with auth tags
- ✅ 4-layer prompt injection defense
- ✅ Pino logger with secret redaction
- ✅ Slack signature verification
- ✅ Zod schema validation
- ✅ Rate limiting on Slack API calls

---

## 3. Production Readiness Checklist

### Infrastructure

- [ ] **Database**
  - [ ] PostgreSQL with connection pooling (PgBouncer)
  - [ ] pgvector extension enabled
  - [ ] Automated backups configured
  - [ ] RLS policies on all tables
  - [ ] SSL/TLS connections required

- [ ] **Redis**
  - [ ] Persistent storage for job queue
  - [ ] Memory limits configured
  - [ ] Eviction policy set (allkeys-lru)
  - [ ] Authentication enabled

- [ ] **Application**
  - [ ] HTTPS only (TLS 1.2+)
  - [ ] Health endpoints configured
  - [ ] Graceful shutdown handling
  - [ ] Error boundaries in place

### Security

- [x] Fix all CRITICAL and HIGH OWASP findings (2026-01-30)
- [x] Environment variables validated (Zod)
- [x] Secrets in secure storage (not git)
- [x] OAuth tokens encrypted at rest
- [ ] Rate limiting on all endpoints
- [ ] CORS properly configured
- [ ] Security headers added
- [ ] Audit logging enabled

### Monitoring & Observability

- [ ] Structured logging (Pino)
- [ ] Error tracking (Sentry recommended)
- [ ] Metrics collection (Prometheus/DataDog)
- [ ] Alerting on failures
- [ ] Request tracing
- [ ] Performance monitoring

### Slack App Configuration

- [ ] HTTP mode (not Socket Mode) for production
- [ ] Redirect URIs updated to production URLs
- [ ] Scopes match production requirements
- [ ] App reviewed and published (if public)

### Testing

- [ ] 90%+ code coverage
- [ ] All tests passing
- [ ] E2E tests in CI/CD
- [ ] Load testing completed
- [ ] Security scan (npm audit)

---

## 4. Slack App Store Requirements

### App Review Checklist

1. **Functionality**
   - [ ] App works as described
   - [ ] All features functional
   - [ ] Error handling graceful
   - [ ] Responsive to events

2. **Security**
   - [ ] OAuth scopes justified
   - [ ] Data handling documented
   - [ ] Privacy policy link
   - [ ] Terms of service link
   - [ ] Security contact

3. **User Experience**
   - [ ] Clear onboarding flow
   - [ ] Help documentation
   - [ ] Support contact method
   - [ ] Uninstall cleans up data

4. **Technical**
   - [ ] Responds within 3 seconds
   - [ ] Handles rate limits
   - [ ] Uses HTTPS only
   - [ ] Validates signatures
   - [ ] No sensitive data in logs

5. **Branding**
   - [ ] App icon (512x512)
   - [ ] App name unique
   - [ ] Description accurate
   - [ ] Screenshots provided
   - [ ] Category selected

### Required URLs
- Privacy Policy: `https://your-domain.com/privacy`
- Terms of Service: `https://your-domain.com/terms`
- Support: `https://your-domain.com/support`
- OAuth Redirect: `https://your-domain.com/slack/oauth_redirect`
- Event Subscription: `https://your-domain.com/slack/events`

### Scopes Justification

| Scope | Justification |
|-------|---------------|
| `app_mentions:read` | Detect @mentions to trigger suggestions |
| `channels:history` | Read conversation context for AI |
| `channels:read` | Get channel info for context |
| `chat:write` | Send ephemeral suggestions |
| `commands` | /speakforme-watch, /speakforme-unwatch, /speakforme-report, /speakforme-tasks |
| `users:read` | Get user info for personalization |

---

## Next Steps

### Phase 1: Security (Before Production) - COMPLETE ✅
1. ~~Fix CRITICAL: Secure test routes~~ ✅
2. ~~Fix CRITICAL: Sign OAuth state~~ ✅
3. ~~Fix HIGH: Add RLS to all tables~~ ✅
4. ~~Fix HIGH: UUID validation for SQL~~ ✅
5. Add security headers (optional)
6. Configure CORS (optional)

### Phase 2: Testing (Before Production)
1. Fix failing tests
2. Add Phase 5 test coverage
3. Add Phase 3 test coverage
4. Achieve 90% coverage

### Phase 3: Infrastructure (Deploy) - READY ✅
1. ~~Create production Dockerfiles~~ ✅
2. ~~Create app.yaml for DigitalOcean~~ ✅
3. ~~Create landing page with Add to Slack~~ ✅
4. ~~Create post-install onboarding~~ ✅
5. Set up DigitalOcean App Platform
6. Configure managed PostgreSQL + pgvector
7. Configure managed Redis
8. Set up monitoring

### Phase 4: Slack Store (Optional)
1. Create privacy policy
2. Create terms of service
3. Prepare app listing
4. Submit for review

---
*Created: 2026-01-27*
*Updated: 2026-01-30 - Security fixes complete, deployment files ready*
