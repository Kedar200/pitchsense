"use client";

import type { Ticket } from "@/types";

interface Props {
  ticket: Ticket;
  active: boolean;
  onClick: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function priorityClass(priority?: string) {
  if (!priority) return "";
  return `badge badge-${priority}`;
}

function statusClass(status: string) {
  return `badge badge-status-${status}`;
}

export function TicketCard({ ticket, active, onClick }: Props) {
  const priority = ticket.triage_result?.priority;
  const category = ticket.triage_result?.category;

  return (
    <div
      className={`ticket-card ${active ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="ticket-card-top">
        <span className="ticket-card-name">{ticket.customer_name}</span>
        <span className="ticket-card-time">{timeAgo(ticket.created_at)}</span>
      </div>
      <div className="ticket-card-subject">{ticket.subject}</div>
      <div className="ticket-card-footer">
        <span className={statusClass(ticket.status)}>{ticket.status.replace("_", " ")}</span>
        {priority && <span className={priorityClass(priority)}>{priority}</span>}
        {category && (
          <span className="badge badge-category">
            {category.replace("_", " ")}
          </span>
        )}
        {ticket.sla_breached && (
          <span className="sla-badge">⚠ SLA</span>
        )}
      </div>
    </div>
  );
}
