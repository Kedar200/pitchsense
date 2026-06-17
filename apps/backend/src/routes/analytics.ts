import { Router, Request, Response } from "express";
import { db } from "../db";

export const analyticsRouter = Router();

const SLA_HOURS = Number(process.env.SLA_URGENT_HOURS ?? 4);

analyticsRouter.get("/", (_req: Request, res: Response) => {
  const tickets = db.prepare("SELECT * FROM tickets").all() as Record<string, unknown>[];
  const triageResults = db.prepare("SELECT * FROM triage_results").all() as Record<string, unknown>[];

  // Latest triage per ticket
  const latestTriage = new Map<string, Record<string, unknown>>();
  for (const t of triageResults) {
    const existing = latestTriage.get(t.ticket_id as string);
    if (!existing || (t.created_at as string) > (existing.created_at as string)) {
      latestTriage.set(t.ticket_id as string, t);
    }
  }

  const total = tickets.length;

  const by_status: Record<string, number> = {};
  const by_category: Record<string, number> = {};
  const by_priority: Record<string, number> = {};
  let sla_risk_count = 0;

  for (const ticket of tickets) {
    const status = ticket.status as string;
    by_status[status] = (by_status[status] ?? 0) + 1;

    const triage = latestTriage.get(ticket.id as string);
    if (triage) {
      const cat = triage.category as string;
      const pri = triage.priority as string;
      const urgency = triage.urgency as string;
      by_category[cat] = (by_category[cat] ?? 0) + 1;
      by_priority[pri] = (by_priority[pri] ?? 0) + 1;

      // SLA check
      if (
        ["high", "critical"].includes(urgency) &&
        !["resolved", "rejected"].includes(status)
      ) {
        const ageHours =
          (Date.now() - new Date(ticket.created_at as string).getTime()) / 1000 / 3600;
        if (ageHours > SLA_HOURS) sla_risk_count++;
      }
    }
  }

  return res.json({ total, by_status, by_category, by_priority, sla_risk_count, sla_threshold_hours: SLA_HOURS });
});
