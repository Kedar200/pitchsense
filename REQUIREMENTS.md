# Support Inbox AI Triage — Requirements (from Assignment PDF)

> Source: `SDE_I_Support_Inbox_AI_Triage.pdf`  
> Position: SDE I | Duration: 12–24 hours

---

## 🎯 What We're Building

An **AI-assisted support inbox** where:
1. Customer tickets come in via a form or API
2. An AI (LLM or mock) **classifies, prioritizes, and drafts a reply** automatically
3. A human reviewer **accepts, edits, or rejects** the AI draft
4. The ticket moves through a clear **status workflow** until resolved

> ⚠️ **No real emails are sent.** Drafts stay inside the app.

---

## 📦 Deliverables

| # | What | Details |
|---|------|---------|
| 1 | GitHub repo or zip | Complete source + setup instructions |
| 2 | README.md | Setup, architecture, AI approach, assumptions, limitations |
| 3 | Loom / screen recording | 3–6 min: ticket creation → triage → review → analytics |
| 4 | Seed tickets | At least one per category and urgency level |

---

## 🔢 Part 1: Core Project (80% of grade)

### 1A — Backend API & Data Model

#### Ticket entity
| Field | Type/Notes |
|---|---|
| `id` | Primary key |
| `customer_name` | string |
| `email` | string |
| `subject` | string |
| `message` | string |
| `status` | `new → triaged → pending_review → accepted/edited/rejected → resolved` |
| `created_at` | datetime |
| `updated_at` | datetime |

#### Triage Result entity
| Field | Type/Notes |
|---|---|
| `category` | `billing`, `bug`, `feature_request`, `account_access`, `general` |
| `sentiment` | e.g. `positive`, `neutral`, `negative`, `frustrated` |
| `urgency` | `low`, `medium`, `high`, `critical` |
| `priority` | `low`, `medium`, `high`, `critical` |
| `confidence` | `0.0 – 1.0` |
| `explanation` | short text rationale |

#### Draft Response entity
| Field | Type/Notes |
|---|---|
| `suggested_reply` | AI-drafted text |
| `tone` | e.g. `empathetic`, `professional` |
| `status` | `pending → accepted / edited / rejected` |
| `reviewer_edits` | human's modified version |

#### Required API endpoints
```
GET    /api/tickets                    # list (filter: status, category, priority)
POST   /api/tickets                    # create ticket
GET    /api/tickets/:id                # get ticket + triage + draft
POST   /api/tickets/:id/triage         # run or re-run triage
POST   /api/tickets/:id/review         # accept / edit / reject draft
GET    /api/analytics                  # counts by category, priority, status
```

---

### 1B — AI Triage & Drafting

LLM **or clean mock service** that returns structured JSON:

```json
{
  "category": "billing",
  "sentiment": "frustrated",
  "urgency": "high",
  "priority": "high",
  "confidence": 0.91,
  "explanation": "Customer reports double charge — financial impact, needs fast resolution.",
  "suggested_reply": "Hi Sarah, we're sorry for the confusion...",
  "tone": "empathetic"
}
```

Requirements:
- Return **validated structured JSON** (Zod schema)
- Handle **low-confidence or malformed output** gracefully (fallback)
- Mock mode must be clearly separated from real LLM mode via env var

---

### 1C — Frontend UI

| View | Must-have features |
|---|---|
| **Inbox** | List of tickets; filters for status, category, priority |
| **Ticket Detail** | Original message + AI triage result (category, urgency, confidence) + explanation |
| **Draft Editor** | Editable text area; Accept / Edit / Reject buttons; visible status |
| **Analytics** | Counts by category, priority, status |
| **All views** | Loading states + error states for triage actions |

---

### 1D — Tests & Docs

| Test | What it covers |
|---|---|
| `triage.schema.test` | Zod validates correct + malformed LLM output |
| `review.flow.test` | accept / edit / reject transitions update ticket status |

README must include:
- Setup steps
- Data model overview
- AI approach + confidence handling
- Assumptions + known limitations
- What's needed before real production use

---

## 🎁 Part 2: Bonus Extensions (pick any, 20% of grade)

### Extension A — Bulk Triage
- Select multiple untriaged tickets → run triage in parallel
- Show per-ticket progress + handle individual failures gracefully

### Extension B — SLA Warning ⭐ (recommended)
- Configurable SLA threshold for urgent tickets (e.g. `SLA_URGENT_HOURS=4`)
- Highlight overdue urgent tickets in inbox with a visual badge
- Dashboard card: "X tickets at SLA risk"

### Extension C — Similar Ticket Suggestions
- Show past tickets with similar category or keywords
- Display previous resolution notes
- Explain matching approach in README

---

## 🛠️ Required Stack

| Layer | Technology |
|---|---|
| Backend | **Node.js + TypeScript** |
| Frontend | **React + TypeScript** (preferred) |
| Database | **SQLite, JSON file, or in-memory** |
| Validation | **Zod** (preferred) |
| LLM | Any provider OR documented mock mode |

### ✅ Out of scope
- Real email sending
- Authentication / agent assignment
- Full CRM integration
- Production deployment
- Complex analytics infrastructure

---

## 📊 Evaluation Rubric

| Criteria | Weight |
|---|---|
| Backend & Data Model | 20% |
| AI Integration | 20% |
| Frontend Flow | 20% |
| End-to-End Functionality | 15% |
| Code Quality (TS, tests, readability) | 5% |
| **Bonus Extension** | **20%** |

---

## ⏱️ Suggested Time Budget

| Phase | Time |
|---|---|
| Schema + ticket states | 30–60 min |
| Backend API | 3–4 hrs |
| AI triage service | 2–4 hrs |
| Frontend | 4–6 hrs |
| Tests + README | 1–2 hrs |
| Bonus extension | 2–4 hrs |

---

## 🔑 Key Design Decisions to Document

1. Mock LLM vs. real LLM — what's the integration boundary?
2. Confidence threshold below which triage is flagged for mandatory review
3. Status transition rules (can a resolved ticket be re-triaged?)
4. SLA threshold value and how it's configured
