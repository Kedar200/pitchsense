import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

// ─── In-memory DB for tests ───────────────────────────────────────────────────
const testDb = new Database(":memory:");
testDb.pragma("foreign_keys = ON");
testDb.exec(`
  CREATE TABLE tickets (
    id TEXT PRIMARY KEY, customer_name TEXT, email TEXT,
    subject TEXT, message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE triage_results (
    id TEXT PRIMARY KEY, ticket_id TEXT,
    category TEXT, sentiment TEXT, urgency TEXT,
    priority TEXT, confidence REAL, explanation TEXT, created_at TEXT
  );
  CREATE TABLE draft_responses (
    id TEXT PRIMARY KEY, ticket_id TEXT, suggested_reply TEXT,
    tone TEXT, status TEXT DEFAULT 'pending',
    reviewer_edits TEXT, created_at TEXT, updated_at TEXT
  );
`);

// ─── Minimal test app ─────────────────────────────────────────────────────────
// We replicate the review logic inline to avoid DB injection complexity
const app = express();
app.use(express.json());

function createTestTicket(status = "pending_review") {
  const ticketId = randomUUID();
  const draftId = randomUUID();
  const now = new Date().toISOString();

  testDb.prepare(
    `INSERT INTO tickets VALUES (?, 'Test User', 'test@example.com', 'Subject', 'Message body here', ?, ?, ?)`
  ).run(ticketId, status, now, now);

  testDb.prepare(
    `INSERT INTO triage_results VALUES (?, ?, 'billing', 'neutral', 'medium', 'medium', 0.8, 'Test explanation here.', ?)`
  ).run(randomUUID(), ticketId, now);

  testDb.prepare(
    `INSERT INTO draft_responses VALUES (?, ?, 'Suggested reply text here for testing purposes.', 'professional', 'pending', NULL, ?, ?)`
  ).run(draftId, ticketId, now, now);

  return { ticketId, draftId };
}

app.post("/review/:id", (req, res) => {
  const { action, reviewer_edits } = req.body;
  const ticket = testDb.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!ticket) return res.status(404).json({ error: "Not found" });
  if (ticket.status !== "pending_review") {
    return res.status(400).json({ error: `Cannot review ticket in status '${ticket.status}'` });
  }
  if (!["accept", "edit", "reject"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }
  if (action === "edit" && !reviewer_edits?.trim()) {
    return res.status(400).json({ error: "reviewer_edits required for edit" });
  }

  const draft = testDb.prepare("SELECT * FROM draft_responses WHERE ticket_id = ?").get(ticket.id as string) as Record<string, unknown>;
  const now = new Date().toISOString();
  const statusMap: Record<string, string> = { accept: "accepted", edit: "edited", reject: "rejected" };

  testDb.prepare("UPDATE draft_responses SET status = ?, reviewer_edits = ?, updated_at = ? WHERE id = ?")
    .run(statusMap[action], reviewer_edits ?? null, now, draft.id as string);
  testDb.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?")
    .run(statusMap[action], now, ticket.id as string);

  return res.json({
    ticket: testDb.prepare("SELECT * FROM tickets WHERE id = ?").get(ticket.id as string),
    draft: testDb.prepare("SELECT * FROM draft_responses WHERE id = ?").get(draft.id as string),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Review flow — accept / edit / reject transitions", () => {
  let ticketId: string;

  beforeEach(() => {
    const ids = createTestTicket("pending_review");
    ticketId = ids.ticketId;
  });

  afterEach(() => {
    testDb.prepare("DELETE FROM draft_responses").run();
    testDb.prepare("DELETE FROM triage_results").run();
    testDb.prepare("DELETE FROM tickets").run();
  });

  it("accept → ticket status becomes 'accepted'", async () => {
    const res = await request(app).post(`/review/${ticketId}`).send({ action: "accept" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("accepted");
    expect(res.body.draft.status).toBe("accepted");
  });

  it("edit → ticket status becomes 'edited' and stores reviewer_edits", async () => {
    const res = await request(app)
      .post(`/review/${ticketId}`)
      .send({ action: "edit", reviewer_edits: "My custom edited reply text." });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("edited");
    expect(res.body.draft.reviewer_edits).toBe("My custom edited reply text.");
  });

  it("reject → ticket status becomes 'rejected'", async () => {
    const res = await request(app).post(`/review/${ticketId}`).send({ action: "reject" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("rejected");
    expect(res.body.draft.status).toBe("rejected");
  });

  it("edit without reviewer_edits → 400 error", async () => {
    const res = await request(app).post(`/review/${ticketId}`).send({ action: "edit" });
    expect(res.status).toBe(400);
  });

  it("cannot review a ticket in 'new' status → 400 error", async () => {
    const { ticketId: newTicketId } = createTestTicket("new");
    const res = await request(app).post(`/review/${newTicketId}`).send({ action: "accept" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Cannot review");
  });

  it("review a non-existent ticket → 404", async () => {
    const res = await request(app).post("/review/nonexistent-id").send({ action: "accept" });
    expect(res.status).toBe(404);
  });
});
