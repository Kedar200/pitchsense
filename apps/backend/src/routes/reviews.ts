import { Router, Request, Response } from "express";
import { db } from "../db";
import { ReviewActionSchema } from "../models/schemas";

export const reviewsRouter = Router();

// POST /api/tickets/:id/review
reviewsRouter.post("/:id/review", (req: Request, res: Response) => {
  const ticket = db
    .prepare("SELECT * FROM tickets WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  // Only allow review when ticket is in pending_review state
  if (ticket.status !== "pending_review") {
    return res.status(400).json({
      error: `Cannot review ticket in status '${ticket.status}'. Ticket must be in 'pending_review' status.`,
    });
  }

  const parsed = ReviewActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.format() });
  }

  const { action, reviewer_edits } = parsed.data;

  if (action === "edit" && !reviewer_edits?.trim()) {
    return res.status(400).json({ error: "reviewer_edits is required when action is 'edit'" });
  }

  const draft = db
    .prepare("SELECT * FROM draft_responses WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(ticket.id as string) as Record<string, unknown> | undefined;

  if (!draft) {
    return res.status(400).json({ error: "No draft response found for this ticket" });
  }

  const now = new Date().toISOString();

  // Map action → statuses
  const draftStatusMap: Record<string, string> = {
    accept: "accepted",
    edit: "edited",
    reject: "rejected",
  };

  const ticketStatusMap: Record<string, string> = {
    accept: "accepted",
    edit: "edited",
    reject: "rejected",
  };

  // Update draft
  db.prepare(
    "UPDATE draft_responses SET status = ?, reviewer_edits = ?, updated_at = ? WHERE id = ?"
  ).run(draftStatusMap[action], reviewer_edits ?? null, now, draft.id as string);

  // Update ticket
  db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?").run(
    ticketStatusMap[action],
    now,
    ticket.id as string
  );

  const updatedTicket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticket.id as string) as Record<string, unknown>;
  const updatedDraft = db.prepare("SELECT * FROM draft_responses WHERE id = ?").get(draft.id as string);

  return res.json({
    ticket: updatedTicket,
    draft_response: updatedDraft,
  });
});

// POST /api/tickets/:id/resolve
reviewsRouter.post("/:id/resolve", (req: Request, res: Response) => {
  const ticket = db
    .prepare("SELECT * FROM tickets WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const allowedStatuses = ["accepted", "edited"];
  if (!allowedStatuses.includes(ticket.status as string)) {
    return res.status(400).json({
      error: `Cannot resolve ticket in status '${ticket.status}'. Must be accepted or edited first.`,
    });
  }

  db.prepare("UPDATE tickets SET status = 'resolved', updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    ticket.id as string
  );

  return res.json({ message: "Ticket resolved", id: ticket.id });
});
