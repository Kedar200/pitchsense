import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../db";
import { CreateTicketSchema } from "../models/schemas";
import { triageService } from "../services/triage";

export const ticketsRouter = Router();

const SLA_HOURS = Number(process.env.SLA_URGENT_HOURS ?? 4);

function isSlaBreached(createdAt: string, urgency: string): boolean {
  if (!["high", "critical"].includes(urgency)) return false;
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 1000 / 3600;
  return ageHours > SLA_HOURS;
}

function enrichTicket(ticket: Record<string, unknown>) {
  const triage = db
    .prepare("SELECT * FROM triage_results WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(ticket.id as string) as Record<string, unknown> | undefined;

  const draft = db
    .prepare("SELECT * FROM draft_responses WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(ticket.id as string) as Record<string, unknown> | undefined;

  const sla_breached =
    triage && !["resolved", "rejected"].includes(ticket.status as string)
      ? isSlaBreached(ticket.created_at as string, triage.urgency as string)
      : false;

  return { ...ticket, triage_result: triage ?? null, draft_response: draft ?? null, sla_breached };
}

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

ticketsRouter.get("/", (req: Request, res: Response) => {
  const { status, category, priority } = req.query;

  let query = "SELECT * FROM tickets WHERE 1=1";
  const params: unknown[] = [];

  if (status) { query += " AND status = ?"; params.push(status); }

  if (category || priority) {
    const subIds = db
      .prepare(
        `SELECT ticket_id FROM triage_results WHERE 1=1
         ${category ? "AND category = ?" : ""}
         ${priority ? "AND priority = ?" : ""}
         ORDER BY created_at DESC`
      )
      .all(...[category, priority].filter(Boolean))
      .map((r: unknown) => (r as { ticket_id: string }).ticket_id);

    if (subIds.length === 0) return res.json([]);
    query += ` AND id IN (${subIds.map(() => "?").join(",")})`;
    params.push(...subIds);
  }

  query += " ORDER BY created_at DESC";

  const tickets = (db.prepare(query).all(...params) as Record<string, unknown>[]).map(enrichTicket);
  return res.json(tickets);
});

// ─── POST /api/tickets ────────────────────────────────────────────────────────

ticketsRouter.post("/", (req: Request, res: Response) => {
  const parsed = CreateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.format() });
  }

  const ticket = {
    id: randomUUID(),
    ...parsed.data,
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO tickets (id, customer_name, email, subject, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ticket.id, ticket.customer_name, ticket.email,
    ticket.subject, ticket.message, ticket.status,
    ticket.created_at, ticket.updated_at
  );

  return res.status(201).json(ticket);
});

// ─── GET /api/tickets/:id ─────────────────────────────────────────────────────

ticketsRouter.get("/:id", (req: Request, res: Response) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  return res.json(enrichTicket(ticket));
});

// ─── POST /api/tickets/:id/triage ────────────────────────────────────────────

ticketsRouter.post("/:id/triage", async (req: Request, res: Response) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  try {
    const llmOutput = await triageService.triage(ticket as never);

    // Store triage result
    const triageId = randomUUID();
    db.prepare(
      `INSERT INTO triage_results (id, ticket_id, category, sentiment, urgency, priority, confidence, explanation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      triageId, ticket.id, llmOutput.category, llmOutput.sentiment,
      llmOutput.urgency, llmOutput.priority, llmOutput.confidence,
      llmOutput.explanation, new Date().toISOString()
    );

    // Upsert draft response (delete old, insert new)
    db.prepare("DELETE FROM draft_responses WHERE ticket_id = ?").run(ticket.id);
    const draftId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO draft_responses (id, ticket_id, suggested_reply, tone, status, reviewer_edits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)`
    ).run(draftId, ticket.id, llmOutput.suggested_reply, llmOutput.tone, now, now);

    // Update ticket status
    db.prepare("UPDATE tickets SET status = 'pending_review', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), ticket.id);

    const updatedTicket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticket.id) as Record<string, unknown>;
    return res.json(enrichTicket(updatedTicket));
  } catch (err) {
    console.error("Triage error:", err);
    return res.status(500).json({ error: "Triage failed. Please try again." });
  }
});
