# Ideas & Feature Backlog

A living document for feature ideas, enhancements, and future directions.

---

## High Priority Ideas

### 1. Automatic Actionable Detection
**Added:** 2026-02-02
**Status:** Idea

Automatically detect actionable items from conversations and create a personal task triage.

**Example:**
```
Andrea: Hey Chris, when you have time, can you take a look at the Product Levels?
        I also tweaked JD's for my reports.
        Pending to do: KPI's based on OKR's

Chris (Me): Will do! I'll let you know when I get to it.
```

**What it does:**
- Parse messages for action requests directed at the user
- Detect commitments made by the user ("Will do", "I'll handle", "On it")
- Extract deadlines (implicit: "tomorrow", "when you have time"; explicit: "by Friday")
- Build a personal triage/task list per workspace
- Daily digest of pending actions

**Implementation ideas:**
- Use AI to classify messages as: request, commitment, deadline, FYI
- Store in `actionable_items` table with status tracking
- Slack reminder integration for follow-ups
- Dashboard view of pending items
- Auto-detect completion ("Done!", "Completed", etc.)

**Potential UI:**
- `/tasks` command to see pending items
- Daily morning summary in DM
- "Mark complete" button on task cards
- Integration with external task managers (Todoist, Linear, etc.)

---

## Medium Priority Ideas

### 2. Team Communication Analytics
**Status:** Idea

Provide managers with anonymized insights on team communication patterns.
- Response time trends
- Collaboration frequency
- Meeting follow-up completion rates

### 3. Smart Reply Scheduling
**Status:** Idea

Suggest optimal times to send messages based on recipient's activity patterns.
- "Sarah typically responds faster in the morning"
- Schedule delivery for recipient's working hours

### 4. Context-Aware Templates
**Status:** Idea

Pre-built response templates that adapt to conversation context.
- Decline meeting politely
- Request deadline extension
- Provide status update
- Escalate issue appropriately

---

## Low Priority / Future Ideas

### 5. Multi-Language Support
Auto-detect and respond in the appropriate language.

### 6. Voice Note Transcription + Response
Generate responses for voice messages after transcription.

### 7. Email Integration
Extend beyond Slack to email (Gmail, Outlook).

---

## Completed Ideas
*Ideas that have been implemented*

- [x] Referral program with gamification (v1.0)
- [x] Usage-based billing with overage (v1.0)
- [x] Person context notes (v1.0)
- [x] YOLO mode / auto-respond (v1.0)

---

## How to Add Ideas

Add new ideas with:
- **Date added**
- **Status**: Idea → Planned → In Progress → Shipped
- **Description** of the problem it solves
- **Example** user scenario
- **Implementation ideas** (rough technical approach)
