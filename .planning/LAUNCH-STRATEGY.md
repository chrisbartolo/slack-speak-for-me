# Launch Strategy: Slack Speak for Me

## Current State

- **Product**: Feature-complete, live on DigitalOcean (speakforme.app)
- **Install**: Open — anyone can install via "Add to Slack"
- **Audience**: Zero (no email list, no social, no existing users)
- **Slack Store**: Requires 5+ active workspaces before submission
- **Product Hunt**: No account yet
- **Owned channels**: Website only

## Strategy Overview

Three sequential phases designed to go from zero users to Slack App Directory listing and Product Hunt launch:

1. **Seed** — Get 5-10 active workspaces through direct outreach
2. **Slack Store** — Submit to Slack App Directory once threshold met
3. **Product Hunt** — Coordinate a PH launch for maximum visibility

---

## Phase 1: Seed Users (Weeks 1-3)

**Goal**: 5-10 active workspaces installing and using the app.

You can't buy your way to the first 5 — these come from direct, manual effort. Every early user also gives you feedback to polish before the bigger launches.

### 1.1 Personal Network Mining

List every person you know who:
- Works in a team that uses Slack daily
- Deals with difficult workplace communication (client-facing, cross-functional, management)
- Is technically curious / early adopter type

Ask them directly: *"I built an AI tool that suggests responses to tricky Slack messages. Can I get you to try it for a week? Takes 2 minutes to install."*

**Target**: 3-5 installs from personal network alone.

### 1.2 Community Seeding

Post in communities where your target users hang out. Not spammy "check out my app" — provide value first, mention the tool naturally.

**High-value communities:**

| Community | Approach |
|-----------|----------|
| **r/Slack** | Answer questions about Slack workflows, mention tool when relevant |
| **r/SaaS** | Share the build journey — indie hackers love build-in-public stories |
| **r/startups** | Post asking for beta testers for AI Slack tool |
| **Indie Hackers** | Build log / milestone post about shipping the product |
| **Hacker News (Show HN)** | Show HN post — good for developer/tech audience |
| **Product-led Slack communities** | Lenny's Newsletter Slack, SaaS community Slacks |
| **LinkedIn** | Post about the problem you're solving (workplace communication friction) |

**Template for community posts:**

> I built an AI assistant that sits inside Slack and privately suggests responses to difficult messages — the kind where you'd normally spend 15 minutes agonizing over wording. It learns your writing style so suggestions sound like you, not a robot.
>
> Looking for 5-10 people to try it free for a month and give honest feedback. Install takes 2 minutes: [link]
>
> Happy to answer any questions about the tech, privacy setup, or use cases.

### 1.3 Direct Outreach

Find people on Twitter/X and LinkedIn who publicly complain about:
- Difficult workplace communication
- Spending too long writing emails/Slack messages
- Dealing with challenging colleagues or clients

DM them with a personalized offer to try the tool free. Not a sales pitch — a genuine "I built something that might help with exactly this."

### 1.4 Build-in-Public Content

Write 2-3 LinkedIn or Twitter posts about:
- The problem you personally experienced (the CMO story from PROJECT.md is compelling)
- What you built and why
- The tech behind it (AI style learning, prompt injection defense, ephemeral delivery)

Build-in-public content converts because it's authentic. People install because they relate to the story, not because of a feature list.

### 1.5 Parallel Setup Tasks

While seeding users, set up the infrastructure for later phases:

- [ ] **Create Product Hunt account** — Start engaging with other products, build profile
- [ ] **Set up email capture** — Add a simple email signup to the landing page (Resend, Loops, or Buttondown)
- [ ] **Create Twitter/X account** — @speakformeapp or similar, start posting
- [ ] **Set up basic analytics** — PostHog, Plausible, or similar to track installs and usage
- [ ] **Collect testimonials** — Ask every early user for a quote about their experience
- [ ] **Record a demo video** — 60-90 second Loom showing the core flow (watch → suggestion → refine → copy)
- [ ] **Create "Add to Slack" social card** — OG image for link sharing

---

## Phase 2: Slack App Directory Submission (Week 3-4)

**Goal**: Listed in the Slack App Directory.

### 2.1 Pre-Submission Checklist

You already have most of this done. Verify before submitting:

- [x] App manifest with all scopes justified
- [x] Privacy Policy at speakforme.app/privacy
- [x] Terms of Service at speakforme.app/terms
- [x] Support email (support@speakforme.app)
- [x] Short description (75 chars): "Private AI suggestions for difficult Slack messages."
- [x] Long description with features, privacy, and pricing
- [x] Security & data questionnaire completed
- [x] LLM disclosure completed
- [x] Test instructions written
- [ ] **5+ active workspaces** (from Phase 1)
- [ ] **Screenshots** — Verify all 6 marketplace screenshots exist and are current
- [ ] **Demo video** — Short walkthrough (optional but helps approval)
- [ ] **Sub-processors page** — Verify speakforme.app/sub-processors is live
- [ ] **GDPR page** — Verify speakforme.app/gdpr is live

### 2.2 Submission Process

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Your App → **Submit to App Directory**
2. Fill in listing details from `.planning/SLACK-MARKETPLACE-LISTING.md`
3. Upload screenshots (1600x1000px, <2MB each)
4. Complete the security review questionnaire
5. Submit for review

**Review timeline**: Slack reviews typically take 1-3 weeks. They may come back with questions or required changes.

### 2.3 Common Rejection Reasons to Pre-empt

| Issue | Status | Action |
|-------|--------|--------|
| Unused scopes | Check | Audit manifest — remove any scope not actively used |
| Missing scope justifications | Done | All scopes justified in listing doc |
| Privacy policy incomplete | Done | Comprehensive GDPR-compliant policy |
| No test instructions | Done | Step-by-step testing guide included |
| Bot sends unsolicited messages | Clear | Bot only responds to explicit triggers |
| LLM not disclosed | Done | Full Anthropic/Claude disclosure |
| Data residency unclear | Done | EU hosting documented |

### 2.4 Post-Approval Actions

Once listed:
- Update landing page: add "Available on Slack App Directory" badge
- Update all social profiles with the Slack Store link
- Send email to early users thanking them and asking for a Slack Store review
- Create a blog post: "We're now on the Slack App Directory"

---

## Phase 3: Product Hunt Launch (Week 5-6)

**Goal**: Product of the Day (or at minimum, top 5) to drive a spike of installs and awareness.

### 3.1 Pre-Launch Preparation (Start 2-3 weeks before launch day)

**Product Hunt profile setup:**
- Create maker profile with real photo and bio
- Follow relevant people (AI tools, Slack tools, productivity makers)
- Upvote and comment on 10-15 other products genuinely
- Complete your maker profile fully (links, about, etc.)

**Listing preparation:**
- **Tagline** (60 chars): "AI that writes your difficult Slack messages for you"
- **Description**: Expand on the problem → solution → how it works → differentiators
- **Gallery**: 5-6 images — hero, screenshots, before/after, feature overview
- **Demo video**: 60-90 second walkthrough (Loom or polished edit)
- **First comment**: Pre-write a maker comment explaining your story (the CMO scenario)
- **Topic tags**: AI, Slack, Productivity, Communication, Workplace

**Build supporter list:**
- Ask every early user to support on launch day
- Post in communities 1-2 days before: "Launching on PH tomorrow"
- Email your list (if built by now)
- DM contacts who'd genuinely find it interesting

### 3.2 Choosing Launch Day

- **Best days**: Tuesday, Wednesday, Thursday
- **Avoid**: Monday (competition from weekend builders), Friday/weekend (lower traffic)
- **Time**: PH resets at 12:01 AM PT — have listing ready to go live at midnight
- **Check competition**: Look at upcoming launches to avoid going head-to-head with well-funded competitors

### 3.3 Launch Day Execution

**Midnight PT:**
- Listing goes live
- Post your first maker comment immediately (the personal story)

**Morning (6-10 AM PT):**
- Share on all social channels with direct PH link
- Send email blast to list
- DM your supporter list: "We're live on Product Hunt! Would love your support"
- Post in relevant Slack/Discord communities

**All day:**
- Respond to EVERY comment on PH within 30 minutes
- Thank supporters personally
- Share updates and behind-the-scenes on Twitter/LinkedIn
- Monitor for questions and engage authentically

**Evening:**
- Post a "thank you" update regardless of ranking
- Share final position on social media

### 3.4 Post-Launch Follow-up

**Week after PH:**
- Follow up with everyone who commented or engaged
- Write a blog post: "What we learned launching on Product Hunt"
- Share metrics publicly (installs, traffic, feedback) — build-in-public audience loves this
- Convert PH traffic into email subscribers
- Reach out to anyone who left interesting comments for deeper conversations

---

## Ongoing Momentum

After the initial launch phases, maintain momentum with regular touchpoints:

### Content Calendar (Monthly)

| Week | Activity |
|------|----------|
| 1 | Feature update or improvement announcement |
| 2 | Use case story / customer spotlight |
| 3 | Educational content (workplace communication tips) |
| 4 | Build-in-public update (metrics, learnings, roadmap) |

### Channels to Maintain

| Channel | Frequency | Content Type |
|---------|-----------|--------------|
| Blog (speakforme.app/blog) | 2x/month | Use cases, product updates, communication tips |
| Email newsletter | 2x/month | Product updates, tips, user stories |
| Twitter/X | 3-5x/week | Build-in-public, tips, engagement |
| LinkedIn | 2-3x/week | Professional communication content, product updates |

### Borrowed Channel Opportunities

- **Podcasts**: Pitch to SaaS/productivity/AI podcasts about workplace AI
- **Newsletters**: Get featured in AI tool roundup newsletters (Ben's Bites, The Neuron, etc.)
- **YouTube**: Send product to Slack/productivity YouTubers for review
- **Blog guest posts**: Write about workplace communication + AI for relevant publications

---

## Metrics to Track

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|----------------|----------------|----------------|
| Active workspaces | 5-10 | 20-50 | 100+ |
| Monthly suggestions generated | 50+ | 200+ | 1000+ |
| Paid conversions | 1-2 | 5-10 | 20+ |
| Email subscribers | 50 | 200 | 500+ |
| Slack Store reviews | — | 3-5 | 10+ |

---

## Immediate Action Items

Priority-ordered list of what to do right now:

1. **List 20 people** from your personal/professional network who use Slack daily
2. **Reach out to 5** of them this week with a personal ask to try the app
3. **Create a Product Hunt account** and start engaging
4. **Write your first build-in-public post** (LinkedIn or Twitter) about why you built this
5. **Set up email capture** on the landing page
6. **Record a 60-second demo video** of the core flow
7. **Verify all marketplace screenshots** exist and are up-to-date
8. **Check that sub-processors and GDPR pages** are live on speakforme.app

---
*Created: 2026-02-04*
