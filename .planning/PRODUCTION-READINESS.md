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

### Summary: 2 Critical, 2 High, 15 Medium, 2 Low findings

### CRITICAL Issues (Fix Before Production)

#### 1. Test Routes Exposed Without Authentication
**File:** `routes/test.ts`
**Risk:** Full AI/database access without auth in non-production
**Fix:** Add token-based authentication or move to separate port

```typescript
// Add to test routes
const TEST_API_KEY = process.env.TEST_API_KEY;
if (!TEST_API_KEY || req.headers['x-test-token'] !== TEST_API_KEY) {
  res.writeHead(403);
  res.end(JSON.stringify({ error: 'Unauthorized' }));
  return;
}
```

#### 2. Missing CSRF Protection in OAuth State
**File:** `oauth/google-oauth.ts`
**Risk:** State parameter forgery, token hijacking
**Fix:** Implement HMAC-signed state with timestamp

```typescript
import crypto from 'crypto';

function generateSecureState(workspaceId: string, userId: string): string {
  const payload = { workspaceId, userId, ts: Date.now(), nonce: crypto.randomBytes(16).toString('hex') };
  const state = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', process.env.STATE_SECRET!).update(state).digest('hex');
  return `${state}.${sig}`;
}

function validateSecureState(stateWithSig: string): { workspaceId: string; userId: string } {
  const [state, sig] = stateWithSig.split('.');
  const expectedSig = crypto.createHmac('sha256', process.env.STATE_SECRET!).update(state).digest('hex');
  if (sig !== expectedSig) throw new Error('Invalid state signature');
  const payload = JSON.parse(Buffer.from(state, 'base64').toString());
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new Error('State expired');
  return payload;
}
```

### HIGH Issues

#### 3. Insufficient RLS Policy Coverage
**Risk:** Cross-workspace data access
**Fix:** Apply RLS to all workspace-scoped tables

```sql
-- Add to migration
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_style_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinement_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_config ENABLE ROW LEVEL SECURITY;

-- Create policies for each
CREATE POLICY tenant_isolation ON installations
USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
-- ... repeat for each table
```

#### 4. Weak OAuth State Parameter
See Critical #2 above.

### MEDIUM Issues (Fix Before Scale)

| Issue | File | Fix |
|-------|------|-----|
| Rate limiting on test endpoints | routes/test.ts | Add IP-based rate limiter |
| SSRF in response URL | jobs/workers.ts | Validate Slack domain |
| Verbose health endpoint | handlers/health.ts | Reduce info in production |
| Missing CORS headers | app.ts | Add explicit CORS config |
| Console.log usage | Various | Replace with logger |
| No audit logging | Services | Add audit log table |
| SQL template literal | database/client.ts | Validate UUID format |

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

- [ ] Fix all CRITICAL and HIGH OWASP findings
- [ ] Environment variables validated (Zod)
- [ ] Secrets in secure storage (not git)
- [ ] OAuth tokens encrypted at rest
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
| `commands` | /watch, /unwatch, /generate-report |
| `users:read` | Get user info for personalization |

---

## Next Steps

### Phase 1: Security (Before Production)
1. Fix CRITICAL: Secure test routes
2. Fix CRITICAL: Sign OAuth state
3. Fix HIGH: Add RLS to all tables
4. Add security headers
5. Configure CORS

### Phase 2: Testing (Before Production)
1. Fix failing tests
2. Add Phase 5 test coverage
3. Add Phase 3 test coverage
4. Achieve 90% coverage

### Phase 3: Infrastructure (Deploy)
1. Set up DigitalOcean App Platform
2. Configure managed PostgreSQL
3. Configure managed Redis
4. Set up monitoring

### Phase 4: Slack Store (Optional)
1. Create privacy policy
2. Create terms of service
3. Prepare app listing
4. Submit for review

---
*Created: 2026-01-27*
