# Phase 19: Satisfaction Measurement - Research

**Researched:** 2026-02-04
**Domain:** User satisfaction tracking, health scoring, and communication quality analytics
**Confidence:** HIGH

## Summary

Phase 19 implements a multi-faceted satisfaction measurement system combining periodic NPS-style surveys delivered via Slack DMs with computed health scores that aggregate five key metrics: acceptance rate (25%), response time (20%), sentiment (20%), satisfaction (20%), and engagement (15%). Research shows that the standard 0-10 NPS scale outperforms 5-point alternatives, with quarterly frequency (30-90 days between surveys) preventing survey fatigue while maintaining high response rates (25-40% for in-app surveys). Health scores normalize disparate metrics to a 0-100 scale using min-max normalization, enabling trend visualization and before/after comparisons. BullMQ's Job Scheduler API (v5.16.0+) provides robust weekly cron scheduling with timezone support, while Slack Block Kit offers rich interactive elements (radio buttons, static_select, buttons) for survey delivery in DMs.

**Primary recommendation:** Use Slack Block Kit with radio_buttons for 0-10 NPS scale, schedule surveys quarterly per user with 30-day minimum frequency caps, compute weekly health scores using weighted min-max normalization, and visualize trends with Tremor charts in admin dashboard.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.16.0+ | Weekly health score calculation scheduler | Job Scheduler API replaces deprecated repeatable API, provides robust cron patterns with timezone support |
| Slack Block Kit | Current (Bolt 4.x) | Survey delivery via DM with interactive elements | Official Slack framework for rich messages, supports radio_buttons and static_select for ratings |
| Drizzle ORM | Current | Schema for satisfaction_surveys and communication_health_scores | Project standard, supports PostgreSQL window functions for trend analysis |
| Tremor | Current | Admin dashboard charts for health scores and trends | Project standard for dashboards, provides 35+ components including LineChart and AreaChart |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL window functions | 9.4+ | Rolling window calculations for trends | Compute moving averages, percentile_cont for health score percentiles |
| date-fns or Day.js | Current | Survey frequency enforcement (30-90 day caps) | Calculate "last surveyed" + 30 days to prevent fatigue |
| Zod | Current | Runtime validation for survey responses and health score data | Project standard for type-safe data validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ Job Scheduler | node-cron or agenda | BullMQ already in project, provides Redis-backed persistence, upsert API prevents duplicates |
| Slack Block Kit | Slack modals or email surveys | Block Kit in DMs has 25-40% response rate vs email's 10-20%, contextual within Slack workspace |
| Min-max normalization | Z-score normalization | Min-max produces intuitive 0-100 scale, z-scores produce negative values requiring additional transformation |

**Installation:**
```bash
# All dependencies already in project (BullMQ, Drizzle, Tremor, Slack Bolt)
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/slack-backend/src/
├── jobs/
│   ├── satisfaction-survey.ts      # Weekly survey delivery job
│   ├── health-score-calculator.ts  # Weekly health score computation
│   └── schedulers.ts               # Add setupSatisfactionSchedulers()
├── services/
│   ├── satisfaction-survey.ts      # Survey Block Kit builder, DM delivery
│   └── health-score.ts             # Weighted score calculation logic
└── handlers/
    └── actions/
        └── satisfaction-survey.ts  # Handle survey response interactions

apps/web-portal/app/
├── api/
│   └── admin/
│       └── satisfaction/
│           ├── health-scores/route.ts     # GET health scores with date range
│           ├── survey-responses/route.ts  # GET satisfaction survey data
│           └── trends/route.ts            # GET trend data for charts
└── admin/
    └── satisfaction/
        ├── page.tsx                       # Main dashboard with tabs
        ├── health-gauge.tsx               # 0-100 gauge component
        └── trend-charts.tsx               # Tremor charts for time series

packages/database/src/
└── schema.ts                              # Add satisfaction_surveys, communication_health_scores tables
```

### Pattern 1: Survey Delivery via Slack Block Kit DM
**What:** Periodic satisfaction surveys delivered as interactive Block Kit messages to user DMs
**When to use:** Quarterly per user (90 days) or on-demand triggers (e.g., after significant usage milestone)
**Example:**
```typescript
// Service: satisfaction-survey.ts
import type { WebClient } from '@slack/web-api';
import type { Block, KnownBlock } from '@slack/types';

export function buildSatisfactionSurveyBlocks(surveyId: string): (Block | KnownBlock)[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Quick Feedback',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'How likely are you to recommend Slack Speak for Me to a colleague?',
      },
    },
    {
      type: 'actions',
      block_id: `satisfaction_survey_${surveyId}`,
      elements: [
        {
          type: 'radio_buttons',
          action_id: 'satisfaction_rating',
          options: Array.from({ length: 11 }, (_, i) => ({
            text: { type: 'plain_text', text: String(i) },
            value: String(i),
          })),
        },
      ],
    },
    {
      type: 'input',
      block_id: 'satisfaction_feedback',
      optional: true,
      label: { type: 'plain_text', text: 'What can we improve?' },
      element: {
        type: 'plain_text_input',
        action_id: 'feedback_text',
        multiline: true,
        max_length: 500,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Submit' },
          action_id: 'submit_satisfaction_survey',
          value: surveyId,
          style: 'primary',
        },
      ],
    },
  ];
}

export async function deliverSatisfactionSurvey(
  client: WebClient,
  userId: string,
  surveyId: string
): Promise<void> {
  const blocks = buildSatisfactionSurveyBlocks(surveyId);

  await client.chat.postMessage({
    channel: userId, // DM to user
    text: 'Quick feedback request',
    blocks,
  });
}
```

### Pattern 2: Weighted Health Score Calculation
**What:** Compute 0-100 health score from five metrics with configurable weights
**When to use:** Weekly background job to calculate per-user and team-aggregate scores
**Example:**
```typescript
// Service: health-score.ts
interface HealthMetrics {
  acceptanceRate: number;      // 0-1 (from suggestion_feedback)
  avgResponseTimeMs: number;    // milliseconds (from suggestion_metrics)
  avgSentimentScore: number;    // 0-1 (from topic_classifications.sentiment)
  avgSatisfactionScore: number; // 0-10 (from satisfaction_surveys)
  engagementRate: number;       // 0-1 (from usage_events)
}

interface HealthScoreWeights {
  acceptance: number;    // 0.25 (25%)
  responseTime: number;  // 0.20 (20%)
  sentiment: number;     // 0.20 (20%)
  satisfaction: number;  // 0.20 (20%)
  engagement: number;    // 0.15 (15%)
}

const DEFAULT_WEIGHTS: HealthScoreWeights = {
  acceptance: 0.25,
  responseTime: 0.20,
  sentiment: 0.20,
  satisfaction: 0.20,
  engagement: 0.15,
};

// Min-max normalization to [0, 100]
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50; // Default to midpoint if no variation
  return ((value - min) / (max - min)) * 100;
}

export function calculateHealthScore(
  metrics: HealthMetrics,
  weights: HealthScoreWeights = DEFAULT_WEIGHTS
): number {
  // Normalize each metric to 0-100 scale
  // Acceptance rate: already 0-1, multiply by 100
  const acceptanceScore = metrics.acceptanceRate * 100;

  // Response time: lower is better, invert with reasonable bounds (0-60s)
  const responseTimeScore = normalize(
    60000 - Math.min(metrics.avgResponseTimeMs, 60000),
    0,
    60000
  );

  // Sentiment: already 0-1, multiply by 100
  const sentimentScore = metrics.avgSentimentScore * 100;

  // Satisfaction: 0-10 scale, multiply by 10
  const satisfactionScore = metrics.avgSatisfactionScore * 10;

  // Engagement: already 0-1, multiply by 100
  const engagementScore = metrics.engagementRate * 100;

  // Weighted sum
  const healthScore =
    acceptanceScore * weights.acceptance +
    responseTimeScore * weights.responseTime +
    sentimentScore * weights.sentiment +
    satisfactionScore * weights.satisfaction +
    engagementScore * weights.engagement;

  return Math.round(healthScore);
}
```

### Pattern 3: BullMQ Weekly Health Score Job
**What:** Background job scheduled to run weekly, compute health scores for all active users
**When to use:** Sundays at 2 AM UTC to calculate previous week's scores
**Example:**
```typescript
// jobs/health-score-calculator.ts
import { Queue, Worker } from 'bullmq';
import { db, communicationHealthScores, suggestionFeedback, suggestionMetrics } from '@slack-speak/database';
import { calculateHealthScore } from '../services/health-score.js';

interface HealthScoreJobData {
  triggeredBy: 'schedule' | 'manual';
  weekStartDate: string; // ISO date
}

export const healthScoreQueue = new Queue<HealthScoreJobData>('health-score-calculation', {
  connection: redisConnection,
});

export const healthScoreWorker = new Worker<HealthScoreJobData>(
  'health-score-calculation',
  async (job) => {
    const { weekStartDate } = job.data;
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Fetch all active organizations
    const orgs = await db.select().from(organizations).where(eq(organizations.isActive, true));

    for (const org of orgs) {
      // Fetch metrics from past week
      const metrics = await fetchWeeklyMetrics(org.id, weekStart, weekEnd);

      // Calculate health score
      const healthScore = calculateHealthScore(metrics);

      // Insert into communication_health_scores table
      await db.insert(communicationHealthScores).values({
        organizationId: org.id,
        scoreDate: weekStart,
        scorePeriod: 'weekly',
        healthScore,
        acceptanceRate: metrics.acceptanceRate,
        avgResponseTimeMs: metrics.avgResponseTimeMs,
        avgSentimentScore: metrics.avgSentimentScore,
        avgSatisfactionScore: metrics.avgSatisfactionScore,
        engagementRate: metrics.engagementRate,
      });
    }
  },
  { connection: redisConnection }
);

// Setup scheduler: Every Sunday at 2 AM UTC
export async function setupHealthScoreScheduler(): Promise<void> {
  await healthScoreQueue.upsertJobScheduler(
    'weekly-health-score',
    { pattern: '0 2 * * 0', tz: 'UTC' }, // Sunday 2 AM UTC
    {
      name: 'calculate-health-scores',
      data: {
        triggeredBy: 'schedule',
        weekStartDate: new Date().toISOString(),
      },
    }
  );
}
```

### Pattern 4: Trend Visualization with Tremor Charts
**What:** Admin dashboard with LineChart showing health score trends over time
**When to use:** Manager dashboard view for team communication quality monitoring
**Example:**
```typescript
// app/admin/satisfaction/trend-charts.tsx
'use client';
import { LineChart } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';

interface HealthScoreTrend {
  date: string;
  healthScore: number;
  acceptanceRate: number;
  sentiment: number;
}

export function HealthScoreTrendChart({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['health-scores', organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/satisfaction/trends?orgId=${organizationId}&days=90`);
      return res.json() as Promise<HealthScoreTrend[]>;
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <LineChart
      data={data || []}
      index="date"
      categories={['healthScore', 'acceptanceRate', 'sentiment']}
      colors={['blue', 'green', 'purple']}
      valueFormatter={(v) => `${v.toFixed(1)}`}
      yAxisWidth={40}
      showLegend
      showGridLines
      className="h-80"
    />
  );
}
```

### Pattern 5: Survey Frequency Enforcement
**What:** Prevent survey fatigue by enforcing minimum 30-day gap between surveys per user
**When to use:** Before delivering any satisfaction survey
**Example:**
```typescript
// Service: satisfaction-survey.ts
async function canSurveyUser(workspaceId: string, userId: string): Promise<boolean> {
  const lastSurvey = await db
    .select()
    .from(satisfactionSurveys)
    .where(
      and(
        eq(satisfactionSurveys.workspaceId, workspaceId),
        eq(satisfactionSurveys.userId, userId)
      )
    )
    .orderBy(desc(satisfactionSurveys.deliveredAt))
    .limit(1);

  if (lastSurvey.length === 0) return true; // First survey

  const daysSinceLastSurvey =
    (Date.now() - lastSurvey[0].deliveredAt.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceLastSurvey >= 30; // Minimum 30-day gap
}
```

### Anti-Patterns to Avoid
- **Survey spam:** Don't send surveys more frequently than every 30 days per user, causes fatigue and drops response rates by 40-60%
- **Unweighted averages:** Don't use simple average of metrics, different metrics have different business importance
- **Missing normalization:** Don't combine metrics on different scales (0-1, 0-10, milliseconds) without normalization, produces meaningless scores
- **Ignoring timezones:** Don't schedule surveys without timezone awareness, users receive surveys at inappropriate times
- **Blocking surveys:** Don't use Slack modals for surveys, use DM messages so users can respond asynchronously

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Survey delivery scheduling | Custom cron or setTimeout loop | BullMQ Job Scheduler with upsertJobScheduler | Handles server restarts, timezone-aware, Redis-backed persistence, prevents duplicate schedulers |
| NPS score calculation | Custom formula for promoters/detractors | Follow standard NPS formula: % promoters (9-10) - % detractors (0-6) | Industry standard for benchmarking, well-documented cutoffs |
| Min-max normalization | Manual (value - min) / (max - min) | PostgreSQL percentile_cont for dynamic bounds | Handles outliers better, auto-adjusts to data distribution |
| Rolling window aggregates | Manual date filtering with loops | PostgreSQL window functions (ROWS BETWEEN N PRECEDING AND CURRENT ROW) | 10-100x faster than application-level loops, handles edge cases |
| Survey frequency caps | In-memory tracking or cache | Database query with lastSurveyedAt + interval check | Survives restarts, handles distributed workers, single source of truth |

**Key insight:** Satisfaction measurement systems appear simple (just averages and surveys) but contain subtle edge cases: timezone handling for global teams, outlier normalization (one bad week shouldn't tank health score), survey fatigue prevention, and trend smoothing. PostgreSQL window functions and BullMQ's scheduler solve 90% of these complexity patterns.

## Common Pitfalls

### Pitfall 1: Survey Fatigue from Over-Surveying
**What goes wrong:** Sending surveys too frequently (weekly or after every suggestion) causes response rates to plummet from 30% to under 10%, and generates negative sentiment toward the product
**Why it happens:** Developers assume more data = better insights, don't account for user annoyance
**How to avoid:** Enforce minimum 30-day gap between surveys per user, use 90-day (quarterly) as standard frequency, track response rates and pause surveys if rate drops below 15%
**Warning signs:** Response rates declining over time, increase in "dismiss without response" actions, negative feedback mentioning "too many surveys"

### Pitfall 2: Invalid Health Score from Missing Normalization
**What goes wrong:** Combining metrics on different scales (acceptance rate 0-1, response time in milliseconds, satisfaction 0-10) produces nonsensical health scores where response time dominates due to scale magnitude
**Why it happens:** Forgetting that weighted average requires same scale for all inputs
**How to avoid:** Always normalize to 0-100 scale before weighting, use min-max normalization with reasonable bounds (e.g., 0-60s for response time), document normalization logic in code comments
**Warning signs:** Health score highly correlated with only one metric, extreme sensitivity to outliers, scores outside 0-100 range

### Pitfall 3: Timezone Issues in Survey Delivery
**What goes wrong:** Surveys scheduled at "9 AM" deliver at 9 AM UTC, waking up Australian users at 8 PM or bothering US users at 2 AM, causing low response rates and complaints
**Why it happens:** BullMQ defaults to UTC, developers forget to specify `tz` option in upsertJobScheduler
**How to avoid:** Always specify `tz` in BullMQ scheduler config, store user's timezone preference (from Slack user profile or workspace default), test with multiple timezones before shipping
**Warning signs:** Response rates vary significantly by geography, complaints about survey timing, surveys delivered outside working hours

### Pitfall 4: Cold Start Problem for New Users
**What goes wrong:** Health score shows 0 or NaN for new users with insufficient data, dashboard shows alarming red gauge for healthy new users
**Why it happens:** Not enough data points in first week to calculate meaningful averages, division by zero when no suggestions accepted yet
**How to avoid:** Require minimum data threshold (e.g., 5 suggestions) before computing health score, show "Insufficient data" state in UI instead of score, use 30-day rolling window instead of weekly for new users
**Warning signs:** Health scores of 0 for active users, NaN or Infinity in database, spiky health score trends that stabilize after 2-3 weeks

### Pitfall 5: Ignoring Before/After Comparison Baseline
**What goes wrong:** Showing health score trends without establishing baseline makes it impossible to measure improvement, new users can't see if product is helping
**Why it happens:** Focusing on absolute scores instead of relative improvement, not capturing "first month" metrics as baseline cohort
**How to avoid:** Tag first 30 days as "baseline period", compute separate baseline score, show percentage improvement vs baseline in dashboard, use cohort analysis to compare "first month" vs "subsequent months"
**Warning signs:** Users ask "Is this score good?", no way to quantify ROI, can't answer "Did communication quality improve?"

### Pitfall 6: Blocking Survey Interactions
**What goes wrong:** Using Slack modals for surveys forces immediate response, users dismiss to return to work and forget to complete, response rates drop to 5-10%
**Why it happens:** Modals feel more "official" and structured, but they interrupt workflow
**How to avoid:** Use Block Kit in DM messages (not modals), allow async response, send reminder after 3 days if not completed, expire survey after 7 days
**Warning signs:** High dismiss rate without completion, users complain about interruptions, response rates significantly below 20%

### Pitfall 7: No Rolling Window for Trend Smoothing
**What goes wrong:** Health score based on exact 7-day windows shows extreme week-to-week volatility, one bad Monday tanks entire week's score
**Why it happens:** Fixed windows amplify outliers, don't account for natural weekly variation
**How to avoid:** Use 30-day rolling windows for trend calculations, apply moving average smoothing (7-day MA), show raw and smoothed lines on charts to visualize noise vs trend
**Warning signs:** Health score swings wildly week-to-week, chart looks like sawtooth pattern, scores don't match qualitative team health assessment

## Code Examples

Verified patterns from research and best practices:

### NPS Score Categorization (Standard Formula)
```typescript
// Source: Standard NPS methodology, confirmed by multiple survey platforms
// https://www.surveymonkey.com/learn/customer-feedback/csat-vs-nps-similarities-and-differences/

function categorizeNPSResponse(rating: number): 'promoter' | 'passive' | 'detractor' {
  if (rating >= 9) return 'promoter';  // 9-10
  if (rating >= 7) return 'passive';   // 7-8
  return 'detractor';                   // 0-6
}

function calculateNPSScore(responses: number[]): number {
  const total = responses.length;
  if (total === 0) return 0;

  const promoters = responses.filter(r => r >= 9).length;
  const detractors = responses.filter(r => r <= 6).length;

  const promoterPercent = (promoters / total) * 100;
  const detractorPercent = (detractors / total) * 100;

  return Math.round(promoterPercent - detractorPercent);
}
```

### PostgreSQL Rolling Window for Trend Calculation
```sql
-- Source: PostgreSQL window functions documentation
-- https://www.postgresql.org/docs/current/tutorial-window.html

-- 30-day rolling average health score
SELECT
  score_date,
  health_score,
  AVG(health_score) OVER (
    ORDER BY score_date
    ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
  ) AS rolling_30day_avg,
  -- 7-day moving average for smoother trend
  AVG(health_score) OVER (
    ORDER BY score_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_avg
FROM communication_health_scores
WHERE organization_id = $1
ORDER BY score_date DESC;
```

### Before/After Cohort Comparison
```sql
-- Source: Cohort analysis best practices
-- Compare first 30 days vs subsequent months for user progression

WITH user_baseline AS (
  SELECT
    user_id,
    AVG(health_score) AS baseline_score
  FROM communication_health_scores
  WHERE
    score_date >= user_created_at
    AND score_date < user_created_at + INTERVAL '30 days'
  GROUP BY user_id
),
user_current AS (
  SELECT
    user_id,
    AVG(health_score) AS current_score
  FROM communication_health_scores
  WHERE
    score_date >= user_created_at + INTERVAL '30 days'
    AND score_date >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  b.user_id,
  b.baseline_score,
  c.current_score,
  c.current_score - b.baseline_score AS improvement,
  ROUND(((c.current_score - b.baseline_score) / b.baseline_score) * 100, 1) AS improvement_percent
FROM user_baseline b
JOIN user_current c ON b.user_id = c.user_id
WHERE b.baseline_score > 0
ORDER BY improvement DESC;
```

### Slack Block Kit Radio Buttons for 0-10 Scale
```typescript
// Source: Slack Block Kit documentation
// https://api.slack.com/reference/block-kit/block-elements/radio-buttons

const npsRadioOptions = Array.from({ length: 11 }, (_, i) => ({
  text: {
    type: 'plain_text' as const,
    text: String(i),
    emoji: false,
  },
  value: String(i),
}));

const surveyBlocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'On a scale from 0 to 10, how likely are you to recommend Slack Speak for Me?',
    },
  },
  {
    type: 'actions',
    block_id: 'nps_rating',
    elements: [
      {
        type: 'radio_buttons',
        action_id: 'nps_score',
        initial_option: undefined, // No default selection
        options: npsRadioOptions,
      },
    ],
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '0 = Not at all likely  |  10 = Extremely likely',
      },
    ],
  },
];
```

### BullMQ Cron Pattern for Weekly Sunday Job
```typescript
// Source: BullMQ Job Scheduler documentation
// https://docs.bullmq.io/guide/job-schedulers

// Every Sunday at 2 AM in user's timezone
await queue.upsertJobScheduler(
  'weekly-health-score',
  {
    pattern: '0 2 * * 0', // minute hour day month dayOfWeek (0 = Sunday)
    tz: 'America/New_York', // IANA timezone
  },
  {
    name: 'calculate-weekly-health-score',
    data: { triggeredBy: 'schedule' },
  }
);

// Quarterly survey: First day of quarter at 9 AM
// January 1, April 1, July 1, October 1
await queue.upsertJobScheduler(
  'quarterly-satisfaction-survey',
  {
    pattern: '0 9 1 */3 *', // Every 3 months on the 1st at 9 AM
    tz: 'UTC',
  },
  {
    name: 'deliver-satisfaction-survey',
    data: { surveyType: 'quarterly' },
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ repeatable jobs API | BullMQ Job Scheduler API | BullMQ v5.16.0 (2023) | Simpler API with upsertJobScheduler, prevents duplicate schedulers, better handling of updates |
| Email-based NPS surveys | In-app/in-platform surveys | 2020-2022 shift | Response rates increased from 10-20% (email) to 25-40% (in-app) |
| Simple averages for health scores | Weighted composite scores with normalization | 2018+ in SaaS analytics | More accurate representation of multi-dimensional health, prevents metric dominance |
| Fixed survey schedules | Behavioral triggers + frequency caps | 2021+ in customer success | Higher response rates, less fatigue, better timing contextually |
| Slack dialogs for surveys | Block Kit in messages | Slack deprecated dialogs 2020 | Async completion, less intrusive, better mobile experience |

**Deprecated/outdated:**
- **Slack dialogs:** Replaced by Block Kit modals and messages, deprecated 2020
- **BullMQ repeatable jobs:** Use Job Scheduler API (v5.16.0+) instead, cleaner upsert pattern
- **5-point NPS scales:** Standard is 0-10, 5-point scales have 4-14 point variance and poor benchmarking
- **CSAT without NPS:** Modern approach combines both (CSAT for transactional, NPS for relational sentiment)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal survey timing for global teams**
   - What we know: Tuesday-Thursday 9-11 AM has highest response rates, timezone-aware scheduling prevents off-hours delivery
   - What's unclear: Whether to optimize for team's primary timezone or individual user timezones when they differ significantly
   - Recommendation: Use organization's primary timezone (from settings) for team-wide surveys, use manager/admin timezone for manager-triggered surveys

2. **Health score baseline for new organizations**
   - What we know: New users need 30 days of data for meaningful health score, cold start shows 0 or NaN
   - What's unclear: What's a "good" health score (60? 70? 80?) without industry benchmarks, how to set initial expectations
   - Recommendation: Start with "Insufficient data" state, compute first score after 30 days, track population percentiles (show "You're in top 25%") instead of absolute "good/bad" labels

3. **Manager dashboard aggregation level**
   - What we know: Team aggregate health score is useful for managers, individual scores show variation
   - What's unclear: Whether to show all team members' individual scores or only aggregates for privacy, how granular to make drill-down
   - Recommendation: Show team aggregate on main dashboard, allow drill-down to individual scores only for managers with explicit permission, add privacy toggle in settings

4. **Thumbs up/down ratio interpretation**
   - What we know: Phase 15 implemented thumbs up/down feedback on suggestions, should track trend
   - What's unclear: Whether thumbs down ratio above certain threshold (30%? 40%?) should trigger alerts or degraded health score
   - Recommendation: Include thumbs ratio as auxiliary metric (not in weighted health score), show trend separately, investigate if ratio > 40% sustained over 2 weeks

5. **Survey response normalization across cohorts**
   - What we know: Different user cohorts may have different satisfaction baselines (early adopters more forgiving, enterprise users more critical)
   - What's unclear: Whether to normalize satisfaction scores within cohorts or treat all responses equally
   - Recommendation: Start with equal treatment, add cohort segmentation if satisfaction scores show strong cohort correlation (>0.6) after 3 months of data

## Sources

### Primary (HIGH confidence)
- BullMQ Job Scheduler documentation - [https://docs.bullmq.io/guide/job-schedulers](https://docs.bullmq.io/guide/job-schedulers)
- Slack Block Kit documentation - [https://docs.slack.dev/block-kit/](https://docs.slack.dev/block-kit/)
- PostgreSQL window functions documentation - [https://www.postgresql.org/docs/current/tutorial-window.html](https://www.postgresql.org/docs/current/tutorial-window.html)
- Tremor chart library - [https://www.tremor.so/](https://www.tremor.so/)
- NPS survey best practices (CustomerGauge) - [https://customergauge.com/blog/nps-survey-best-practices](https://customergauge.com/blog/nps-survey-best-practices)

### Secondary (MEDIUM confidence)
- In-app survey response rates study (Refiner) - [https://refiner.io/blog/in-app-survey-response-rates/](https://refiner.io/blog/in-app-survey-response-rates/)
- Composite health score methodology (Vitally) - [https://www.vitally.io/post/how-to-create-a-customer-health-score-with-four-metrics](https://www.vitally.io/post/how-to-create-a-customer-health-score-with-four-metrics)
- Survey fatigue prevention (Infeedo) - [https://www.infeedo.ai/blog/13-proven-ways-to-beat-survey-fatigue-double-response-rates-in-2025](https://www.infeedo.ai/blog/13-proven-ways-to-beat-survey-fatigue-double-response-rates-in-2025)
- NPS scale comparison research (MeasuringU) - [https://measuringu.com/nps-scale-change/](https://measuringu.com/nps-scale-change/)
- Cohort analysis for onboarding (Userpilot) - [https://userpilot.com/blog/cohort-analysis/](https://userpilot.com/blog/cohort-analysis/)

### Tertiary (LOW confidence)
- Healthcare communication quality metrics (JMIR 2026) - [https://www.jmir.org/2026/1/e83188](https://www.jmir.org/2026/1/e83188) - Healthcare-specific but methodology applicable
- PostgreSQL percentile calculations tutorial (LeafO) - [https://leafo.net/guides/postgresql-calculating-percentile.html](https://leafo.net/guides/postgresql-calculating-percentile.html) - Community guide, not official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project (BullMQ, Slack Bolt, Drizzle, Tremor), official documentation verified
- Architecture: HIGH - Patterns based on existing codebase patterns (jobs/schedulers.ts, suggestion-delivery.ts), BullMQ and PostgreSQL official examples
- Survey design: HIGH - NPS methodology is industry standard, timing/frequency backed by multiple SaaS survey platform studies with data
- Health scoring: MEDIUM - Weighted normalization methodology well-documented, but specific weights (25/20/20/20/15) are recommendations not empirical
- Pitfalls: MEDIUM - Based on common patterns in literature and best practices, but not project-specific validation

**Research date:** 2026-02-04
**Valid until:** ~60 days (stable domain with slow-moving best practices, BullMQ and Slack APIs mature)
