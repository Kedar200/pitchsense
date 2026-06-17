import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

let testDb: Database.Database;
let app: express.Express;

function createSchema() {
  testDb.exec(`
    CREATE TABLE tickets (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      email TEXT,
      subject TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE triage_results (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      category TEXT,
      sentiment TEXT,
      urgency TEXT,
      priority TEXT,
      confidence REAL,
      explanation TEXT,
      created_at TEXT
    );

    CREATE TABLE draft_responses (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      suggested_reply TEXT,
      tone TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_edits TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

function createTestTicket(status = "pending_review") {
  const ticketId = randomUUID();
  const draftId = randomUUID();
  const now = new Date().toISOString();

  testDb
    .prepare(
      `INSERT INTO tickets
       (id, customer_name, email, subject, message, status, created_at, updated_at)
       VALUES (?, 'Test User', 'test@example.com', 'Subject', 'Message body here', ?, ?, ?)`
    )
    .run(ticketId, status, now, now);

  testDb
    .prepare(
      `INSERT INTO triage_results
       (id, ticket_id, category, sentiment, urgency, priority, confidence, explanation, created_at)
       VALUES (?, ?, 'billing', 'neutral', 'medium', 'medium', 0.8, 'Test explanation here.', ?)`
    )
    .run(randomUUID(), ticketId, now);

  testDb
    .prepare(
      `INSERT INTO draft_responses
       (id, ticket_id, suggested_reply, tone, status, reviewer_edits, created_at, updated_at)
       VALUES (?, ?, 'Suggested reply text here for testing purposes.', 'professional', 'pending', NULL, ?, ?)`
    )
    .run(draftId, ticketId, now, now);

  return { ticketId, draftId };
}

describe("Review flow — accept / edit / reject transitions", () => {
  let ticketId: string;

  beforeAll(async () => {
    testDb = new Database(":memory:");
    testDb.pragma("foreign_keys = ON");
    createSchema();

    vi.doMock("../src/db", () => ({ db: testDb }));
    const { reviewsRouter } = await import("../src/routes/reviews");

    app = express();
    app.use(express.json());
    app.use("/tickets", reviewsRouter);
  });

  beforeEach(() => {
    const ids = createTestTicket("pending_review");
    ticketId = ids.ticketId;
  });

  afterEach(() => {
    testDb.prepare("DELETE FROM draft_responses").run();
    testDb.prepare("DELETE FROM triage_results").run();
    testDb.prepare("DELETE FROM tickets").run();
  });

  it("accept -> ticket status becomes 'accepted'", async () => {
    const res = await request(app).post(`/tickets/${ticketId}/review`).send({ action: "accept" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("accepted");
    expect(res.body.draft_response.status).toBe("accepted");
  });

  it("edit -> ticket status becomes 'edited' and stores reviewer_edits", async () => {
    const res = await request(app)
      .post(`/tickets/${ticketId}/review`)
      .send({ action: "edit", reviewer_edits: "My custom edited reply text." });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("edited");
    expect(res.body.draft_response.status).toBe("edited");
    expect(res.body.draft_response.reviewer_edits).toBe("My custom edited reply text.");
  });

  it("reject -> ticket status becomes 'rejected'", async () => {
    const res = await request(app).post(`/tickets/${ticketId}/review`).send({ action: "reject" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("rejected");
    expect(res.body.draft_response.status).toBe("rejected");
  });

  it("edit without reviewer_edits -> 400 error", async () => {
    const res = await request(app).post(`/tickets/${ticketId}/review`).send({ action: "edit" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("reviewer_edits is required");
  });

  it("cannot review a ticket in 'new' status -> 400 error", async () => {
    const { ticketId: newTicketId } = createTestTicket("new");
    const res = await request(app).post(`/tickets/${newTicketId}/review`).send({ action: "accept" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Cannot review");
  });

  it("review a non-existent ticket -> 404", async () => {
    const res = await request(app).post("/tickets/nonexistent-id/review").send({ action: "accept" });

    expect(res.status).toBe(404);
  });
});
