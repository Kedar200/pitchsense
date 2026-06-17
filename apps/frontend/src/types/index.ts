// ─── Enums ───────────────────────────────────────────────────────────────────

export type TicketStatus =
  | "new"
  | "triaged"
  | "pending_review"
  | "accepted"
  | "edited"
  | "rejected"
  | "resolved";

export type Category =
  | "billing"
  | "bug"
  | "feature_request"
  | "account_access"
  | "general";

export type Urgency = "low" | "medium" | "high" | "critical";
export type Priority = "low" | "medium" | "high" | "critical";
export type Sentiment = "positive" | "neutral" | "negative" | "frustrated";
export type ReviewStatus = "pending" | "accepted" | "edited" | "rejected";
export type ReviewAction = "accept" | "edit" | "reject";

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  customer_name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  triage_result: TriageResult | null;
  draft_response: DraftResponse | null;
  sla_breached: boolean;
}

export interface TriageResult {
  id: string;
  ticket_id: string;
  category: Category;
  sentiment: Sentiment;
  urgency: Urgency;
  priority: Priority;
  confidence: number;
  explanation: string;
  created_at: string;
}

export interface DraftResponse {
  id: string;
  ticket_id: string;
  suggested_reply: string;
  tone: string;
  status: ReviewStatus;
  reviewer_edits: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  customer_name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ReviewPayload {
  action: ReviewAction;
  reviewer_edits?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface Analytics {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  sla_risk_count: number;
  sla_threshold_hours: number;
}
