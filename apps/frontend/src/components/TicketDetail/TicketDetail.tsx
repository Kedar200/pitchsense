"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTicket, runTriage, reviewTicket, resolveTicket } from "@/lib/api";
import type { ReviewAction } from "@/types";

interface Props {
  ticketId: string;
  onClose: () => void;
  onUpdated: () => void;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tier = value >= 0.8 ? "high" : value >= 0.6 ? "medium" : "low";
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-label">
        <span>Confidence</span>
        <span style={{ color: tier === "high" ? "var(--low)" : tier === "medium" ? "var(--medium)" : "var(--critical)" }}>
          {pct}%
        </span>
      </div>
      <div className="confidence-bar-track">
        <div
          className={`confidence-bar-fill ${tier}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TicketDetail({ ticketId, onClose, onUpdated }: Props) {
  const qc = useQueryClient();
  const [draftText, setDraftText] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState("");

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId),
  });

  // Initialise draft text when ticket first loads
  useEffect(() => {
    if (ticket?.draft_response && draftText === null) {
      setDraftText(ticket.draft_response.suggested_reply);
    }
  }, [ticket, draftText]);

  const triageMutation = useMutation({
    mutationFn: () => runTriage(ticketId),
    onSuccess: (t) => {
      qc.setQueryData(["ticket", ticketId], t);
      setDraftText(t.draft_response?.suggested_reply ?? null);
      onUpdated();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { action: ReviewAction; reviewer_edits?: string }) =>
      reviewTicket(ticketId, payload),
    onSuccess: ({ ticket: t }) => {
      qc.setQueryData(["ticket", ticketId], { ...ticket, ...t });
      onUpdated();
      setReviewError("");
    },
    onError: (e: Error) => setReviewError(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveTicket(ticketId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      onUpdated();
    },
  });

  function handleReview(action: ReviewAction) {
    setReviewError("");
    reviewMutation.mutate({
      action,
      reviewer_edits: action === "edit" ? (draftText ?? "") : undefined,
    });
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-line" style={{ marginBottom: 12, width: i % 2 === 0 ? "70%" : "90%" }} />
        ))}
      </div>
    );
  }

  if (error || !ticket) {
    return <div className="error-banner" style={{ margin: 24 }}>Failed to load ticket.</div>;
  }

  const triage = ticket.triage_result;
  const draft = ticket.draft_response;
  const isReviewed = ["accepted", "edited", "rejected", "resolved"].includes(ticket.status);
  const isResolved = ticket.status === "resolved";
  const canTriage = !["resolved"].includes(ticket.status);
  const canReview = ticket.status === "pending_review";
  const canResolve = ["accepted", "edited"].includes(ticket.status);
  const effectiveDraft = draftText ?? draft?.suggested_reply ?? "";

  return (
    <div className="ticket-detail">
      {/* Left: message */}
      <div className="ticket-detail-main">
        <div className="ticket-detail-header">
          <div className="ticket-detail-title">{ticket.subject}</div>
          <div className="ticket-detail-meta">
            <span className="ticket-detail-customer">
              {ticket.customer_name} · {ticket.email}
            </span>
            <span className={`badge badge-status-${ticket.status}`}>
              {ticket.status.replace("_", " ")}
            </span>
            {ticket.sla_breached && <span className="sla-badge">⚠ SLA Risk</span>}
          </div>
        </div>
        <div className="ticket-detail-body">
          <div className="message-bubble">{ticket.message}</div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canTriage && (
              <button
                id="run-triage-btn"
                className="btn btn-primary btn-sm"
                onClick={() => triageMutation.mutate()}
                disabled={triageMutation.isPending}
              >
                {triageMutation.isPending ? (
                  <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Running Triage…</>
                ) : triage ? "↺ Re-run Triage" : "⚡ Run Triage"}
              </button>
            )}
            {canResolve && (
              <button
                id="resolve-btn"
                className="btn btn-success btn-sm"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
              >
                ✓ Mark Resolved
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
          </div>

          {triageMutation.isPending && (
            <div className="triage-running" style={{ marginTop: 16 }}>
              <div className="spinner" style={{ borderTopColor: "var(--accent)" }} />
              AI is analysing the ticket…
            </div>
          )}

          {isResolved && (
            <div className="resolved-notice" style={{ marginTop: 16 }}>
              ✓ This ticket has been resolved
            </div>
          )}
        </div>
      </div>

      {/* Right: triage + draft */}
      <div className="ticket-right-panel">
        {/* Triage result */}
        <div className="panel-section" style={{ overflowY: "auto" }}>
          <div className="panel-section-title">AI Triage Result</div>
          {!triage ? (
            <div className="triage-placeholder">
              No triage yet. Click &quot;Run Triage&quot; to classify this ticket.
            </div>
          ) : (
            <>
              <div className="triage-grid">
                <div className="triage-item">
                  <div className="triage-item-label">Category</div>
                  <div className="triage-item-value">{triage.category.replace("_", " ")}</div>
                </div>
                <div className="triage-item">
                  <div className="triage-item-label">Urgency</div>
                  <div className="triage-item-value" style={{ color: urgencyColor(triage.urgency) }}>
                    {triage.urgency}
                  </div>
                </div>
                <div className="triage-item">
                  <div className="triage-item-label">Priority</div>
                  <div className="triage-item-value" style={{ color: urgencyColor(triage.priority) }}>
                    {triage.priority}
                  </div>
                </div>
                <div className="triage-item">
                  <div className="triage-item-label">Sentiment</div>
                  <div className="triage-item-value">{triage.sentiment}</div>
                </div>
              </div>
              <ConfidenceBar value={triage.confidence} />
              <div className="explanation-text">{triage.explanation}</div>
            </>
          )}
        </div>

        {/* Draft editor */}
        <div className="draft-editor">
          <div className="panel-section-title" style={{ padding: 0 }}>Draft Response</div>
          {!draft ? (
            <div className="triage-placeholder" style={{ padding: 0 }}>
              Run triage first to generate a draft response.
            </div>
          ) : (
            <>
              <div className="draft-tone">
                Tone: <strong>{draft.tone}</strong>
                {isReviewed && draft.status !== "pending" && (
                  <span className={`badge badge-status-${draft.status}`} style={{ marginLeft: 8 }}>
                    {draft.status}
                  </span>
                )}
              </div>
              <textarea
                id="draft-textarea"
                className="draft-textarea"
                value={effectiveDraft}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isReviewed && !canReview}
              />
              {draft.reviewer_edits && ticket.status === "edited" && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  ✏️ Reviewer edited this response
                </div>
              )}
            </>
          )}
        </div>

        {/* Review actions */}
        {canReview && (
          <div className="review-actions">
            {reviewError && (
              <div className="error-banner" style={{ margin: 0, marginBottom: 8, width: "100%" }}>
                {reviewError}
              </div>
            )}
            <button
              id="accept-draft-btn"
              className="btn btn-success btn-sm"
              style={{ flex: 1 }}
              onClick={() => handleReview("accept")}
              disabled={reviewMutation.isPending}
            >
              ✓ Accept
            </button>
            <button
              id="edit-draft-btn"
              className="btn btn-warning btn-sm"
              style={{ flex: 1 }}
              onClick={() => handleReview("edit")}
              disabled={reviewMutation.isPending || !draftText?.trim()}
            >
              ✏ Save Edit
            </button>
            <button
              id="reject-draft-btn"
              className="btn btn-danger btn-sm"
              style={{ flex: 1 }}
              onClick={() => handleReview("reject")}
              disabled={reviewMutation.isPending}
            >
              ✕ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function urgencyColor(level: string) {
  return {
    critical: "var(--critical)",
    high: "var(--high)",
    medium: "var(--medium)",
    low: "var(--low)",
  }[level] ?? "var(--text-primary)";
}
