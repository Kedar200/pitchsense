import type {
  Ticket,
  DraftResponse,
  Analytics,
  CreateTicketPayload,
  ReviewPayload,
} from "@/types";

const BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export function getTickets(params?: {
  status?: string;
  category?: string;
  priority?: string;
}): Promise<Ticket[]> {
  const query = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][]
  ).toString();
  return apiFetch<Ticket[]>(`/tickets${query ? `?${query}` : ""}`);
}

export function getTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}`);
}

export function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return apiFetch<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runTriage(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/triage`, { method: "POST" });
}

export function reviewTicket(
  id: string,
  payload: ReviewPayload
): Promise<{ ticket: Ticket; draft_response: DraftResponse }> {
  return apiFetch<{ ticket: Ticket; draft_response: DraftResponse }>(`/tickets/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveTicket(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/tickets/${id}/resolve`, { method: "POST" });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getAnalytics(): Promise<Analytics> {
  return apiFetch<Analytics>("/analytics");
}
