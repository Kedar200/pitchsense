# Support Inbox AI Triage

> SDE I Take-Home Assignment — AI-assisted support inbox with human review workflow.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with 8 sample tickets
npm run seed --workspace=apps/backend

# 3. Run both servers concurrently
npm run dev
```

- **Backend (Express):** http://localhost:3001
- **Frontend (Next.js):** http://localhost:3000

## Setup Requirements

- Node.js 18+
- npm 9+

## Architecture

```
apps/
  backend/   Express.js REST API   → port 3001
  frontend/  Next.js App Router    → port 3000
apps/backend/data/
  support_inbox.db                 SQLite database (auto-created on first run)
```

### Why Next.js + Express (separate)?

The assignment grades *Backend & Data Model* and *Frontend Flow* independently (20% each). Keeping Express as a standalone REST API makes the backend independently testable and mirrors real production architecture.

Next.js proxies all `/api/*` requests to Express via `next.config.ts` rewrites — no CORS issues in the browser.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Express.js 4 + TypeScript | Standard, well-tested Node.js framework |
| Database | SQLite (`better-sqlite3`) | Lightweight, zero-config, synchronous API |
| Validation | Zod | Compile-time + runtime schema safety |
| Frontend | Next.js 15 App Router | React-based, file-based routing, SSR capable |
| Data fetching | TanStack Query | Caching, background refetch, optimistic updates |
| Tests | Vitest + supertest | Fast unit/integration tests |

## Data Model

### Ticket Statuses (state machine)
```
new → [run triage] → pending_review
pending_review → accepted | edited | rejected
accepted | edited → resolved
rejected → pending_review (re-triage available)
```

### Entities
- **Ticket** — `customer_name`, `email`, `subject`, `message`, `status`
- **Triage Result** — `category`, `sentiment`, `urgency`, `priority`, `confidence`, `explanation`
- **Draft Response** — `suggested_reply`, `tone`, `status`, `reviewer_edits`

### Categories
`billing` · `bug` · `feature_request` · `account_access` · `general`

### Priority / Urgency levels
`critical` · `high` · `medium` · `low`

## AI Classification Approach

The triage service (`apps/backend/src/services/triage.ts`) runs in **mock mode by default**.

**Mock mode:** Keyword matching against the ticket subject + message. Each rule maps keywords to a category, urgency, priority, sentiment, and confidence score. Falls back to `general / low / 0.55` if no keywords match.

**Confidence handling:**
- Confidence < 0.6 → explanation explicitly flags "Low confidence — recommend manual review"
- All LLM output (even mock) is validated through `RawLLMOutputSchema` (Zod) before storage
- If validation fails, a safe fallback response is stored (confidence 0.4, category: general)

**Switching to a real LLM:**
```bash
cp .env.example .env
# Edit .env:
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
```
The `TriageService` checks `process.env.LLM_PROVIDER` and routes to OpenRouter when it is set to `openrouter`; otherwise it uses the local mock triage implementation.

### Verifying AI vs Mock in Logs

Keep the backend terminal open while clicking **Run Triage**. The logs show the exact path used:

```text
[triage] completed source=openrouter ...
```

means the real OpenRouter call succeeded.

```text
[triage] openrouter_failed ...
[api] triage_failed ...
```

means OpenRouter failed and the request was not stored as a mock result. This keeps real-AI testing explicit when `LLM_PROVIDER=openrouter`.

```text
[triage] completed source=mock ...
```

means `LLM_PROVIDER=mock` was configured.

## Bonus Extension: SLA Warning

Urgent/critical tickets that remain unresolved past the SLA threshold are flagged.

- Configure via `SLA_URGENT_HOURS` env var (default: 4 hours)
- Inbox shows a pulsing red `⚠ SLA` badge on at-risk tickets
- Analytics dashboard shows `sla_risk_count` highlighted in red

## API Endpoints

```
GET    /api/tickets                 List tickets (filter: ?status=&category=&priority=)
POST   /api/tickets                 Create ticket
GET    /api/tickets/:id             Get ticket with triage + draft
POST   /api/tickets/:id/triage      Run (or re-run) AI triage
POST   /api/tickets/:id/review      { action: "accept"|"edit"|"reject", reviewer_edits? }
POST   /api/tickets/:id/resolve     Mark accepted/edited ticket as resolved
GET    /api/analytics               Counts by status/category/priority + SLA risk count
GET    /api/health                  Health check
```

## Running Tests

```bash
npm test
```

Tests are in `apps/backend/tests/`:
- `triage.schema.test.ts` — Zod schema validation (10 cases)
- `review.flow.test.ts` — accept/edit/reject state transitions (6 cases)

## Assumptions & Limitations

1. **No real email sending** — draft responses stay inside the app as designed.
2. **No authentication** — out of scope per assignment spec.
3. **Single reviewer** — no multi-agent or assignment workflow.
4. **SQLite** — fine for the demo; would use PostgreSQL in production.
5. **Mock LLM** — deterministic keyword matching. Real LLM would require structured output prompting + retry logic.

## What's Needed Before Production Use

- Replace SQLite with PostgreSQL
- Add authentication (JWT + role-based access)
- Real LLM integration with retry/fallback
- Structured prompt engineering for consistent JSON output
- Rate limiting on triage endpoint (LLM cost control)
- Email/webhook integration for notifying agents
- Audit log for reviewer actions
- Pagination on ticket list
