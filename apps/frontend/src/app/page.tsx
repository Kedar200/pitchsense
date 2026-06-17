"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTickets, createTicket } from "@/lib/api";
import type { Ticket, CreateTicketPayload } from "@/types";
import { TicketCard } from "@/components/Inbox/TicketCard";
import { TicketDetail } from "@/components/TicketDetail/TicketDetail";
import { NavBar } from "@/components/ui/NavBar";

export default function InboxPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "", category: "", priority: "" });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_name: "", email: "", subject: "", message: "" });
  const [formError, setFormError] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => getTickets(filters),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (p: CreateTicketPayload) => createTicket(p),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setShowModal(false);
      setForm({ customer_name: "", email: "", subject: "", message: "" });
      setSelectedId(t.id);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    createMutation.mutate(form);
  }

  return (
    <div className="layout">
      <NavBar active="inbox" />

      {/* Inbox panel */}
      <div className="inbox-panel">
        <div className="inbox-header">
          <div className="inbox-title">
            <span>Inbox</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              {tickets.length} tickets
            </span>
          </div>
          <div className="inbox-filters">
            <div className="filter-row">
              <select
                className="filter-select"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="pending_review">Pending Review</option>
                <option value="accepted">Accepted</option>
                <option value="edited">Edited</option>
                <option value="rejected">Rejected</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                className="filter-select"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">All categories</option>
                <option value="billing">Billing</option>
                <option value="bug">Bug</option>
                <option value="feature_request">Feature Request</option>
                <option value="account_access">Account Access</option>
                <option value="general">General</option>
              </select>
            </div>
            <select
              className="filter-select"
              value={filters.priority}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <button className="new-ticket-btn" onClick={() => setShowModal(true)}>
          + New Ticket
        </button>

        <div className="ticket-list">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 6 }} />
                  <div className="skeleton skeleton-line" style={{ width: "85%" }} />
                  <div className="skeleton skeleton-line" />
                </div>
              ))
            : tickets.length === 0
            ? <p style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 13 }}>No tickets found.</p>
            : tickets.map((t: Ticket) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  active={t.id === selectedId}
                  onClick={() => setSelectedId(t.id)}
                />
              ))}
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {selectedId ? (
          <TicketDetail
            ticketId={selectedId}
            onClose={() => setSelectedId(null)}
            onUpdated={() => qc.invalidateQueries({ queryKey: ["tickets"] })}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📬</div>
            <div className="empty-state-title">Select a ticket</div>
            <div className="empty-state-sub">Choose a ticket from the inbox to view details and review AI triage</div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New Support Ticket</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  id="new-ticket-name"
                  className="form-input"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  id="new-ticket-email"
                  type="email"
                  className="form-input"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  id="new-ticket-subject"
                  className="form-input"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Brief description of issue"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  id="new-ticket-message"
                  className="form-textarea"
                  required
                  minLength={10}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Describe the issue in detail..."
                />
              </div>
              {formError && <div className="error-banner">{formError}</div>}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  id="submit-new-ticket"
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <><div className="spinner" /> Creating…</>
                  ) : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
