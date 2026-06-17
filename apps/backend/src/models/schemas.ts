import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const TicketStatusEnum = z.enum([
  "new",
  "triaged",
  "pending_review",
  "accepted",
  "edited",
  "rejected",
  "resolved",
]);

export const CategoryEnum = z.enum([
  "billing",
  "bug",
  "feature_request",
  "account_access",
  "general",
]);

export const UrgencyEnum = z.enum(["low", "medium", "high", "critical"]);
export const PriorityEnum = z.enum(["low", "medium", "high", "critical"]);
export const SentimentEnum = z.enum(["positive", "neutral", "negative", "frustrated"]);
export const ReviewStatusEnum = z.enum(["pending", "accepted", "edited", "rejected"]);
export const ReviewActionEnum = z.enum(["accept", "edit", "reject"]);

export type TicketStatus = z.infer<typeof TicketStatusEnum>;
export type Category = z.infer<typeof CategoryEnum>;
export type Urgency = z.infer<typeof UrgencyEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type Sentiment = z.infer<typeof SentimentEnum>;
export type ReviewStatus = z.infer<typeof ReviewStatusEnum>;

// ─── Ticket ───────────────────────────────────────────────────────────────────

export const CreateTicketSchema = z.object({
  customer_name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const TicketSchema = CreateTicketSchema.extend({
  id: z.string(),
  status: TicketStatusEnum,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type CreateTicket = z.infer<typeof CreateTicketSchema>;

// ─── Triage Result ────────────────────────────────────────────────────────────

export const TriageResultSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  category: CategoryEnum,
  sentiment: SentimentEnum,
  urgency: UrgencyEnum,
  priority: PriorityEnum,
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  created_at: z.string(),
});

// Schema used to validate raw LLM JSON output
export const RawLLMOutputSchema = z.object({
  category: CategoryEnum,
  sentiment: SentimentEnum,
  urgency: UrgencyEnum,
  priority: PriorityEnum,
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(5, "Explanation too short"),
  suggested_reply: z.string().min(10, "Suggested reply too short"),
  tone: z.string().min(1),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
export type RawLLMOutput = z.infer<typeof RawLLMOutputSchema>;

// ─── Draft Response ───────────────────────────────────────────────────────────

export const DraftResponseSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  suggested_reply: z.string(),
  tone: z.string(),
  status: ReviewStatusEnum,
  reviewer_edits: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DraftResponse = z.infer<typeof DraftResponseSchema>;

// ─── Review Action ────────────────────────────────────────────────────────────

export const ReviewActionSchema = z.object({
  action: ReviewActionEnum,
  reviewer_edits: z.string().optional(),
});

export type ReviewAction = z.infer<typeof ReviewActionSchema>;

// ─── Analytics ────────────────────────────────────────────────────────────────

export const AnalyticsSchema = z.object({
  total: z.number(),
  by_status: z.record(z.number()),
  by_category: z.record(z.number()),
  by_priority: z.record(z.number()),
  sla_risk_count: z.number(),
});

export type Analytics = z.infer<typeof AnalyticsSchema>;
