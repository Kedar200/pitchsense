"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/api";
import { NavBar } from "@/components/ui/NavBar";

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
    refetchInterval: 30_000,
  });

  return (
    <div className="layout">
      <NavBar active="analytics" />
      <div className="main-content" style={{ overflowY: "auto" }}>
        <div className="analytics-page">
          <div className="analytics-header">
            <div className="analytics-title">Analytics</div>
            <div className="analytics-sub">Support inbox overview — live data</div>
          </div>

          {error && (
            <div className="error-banner" style={{ marginBottom: 20 }}>
              Failed to load analytics. Is the backend running?
            </div>
          )}

          {isLoading ? (
            <div style={{ display: "flex", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card" style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line" style={{ width: "60%", height: 10 }} />
                  <div className="skeleton skeleton-line" style={{ width: "40%", height: 28, marginTop: 8 }} />
                </div>
              ))}
            </div>
          ) : data ? (
            <>
              {/* Top stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">{data.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">New</div>
                  <div className="stat-value">{data.by_status["new"] ?? 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending Review</div>
                  <div className="stat-value">{data.by_status["pending_review"] ?? 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Resolved</div>
                  <div className="stat-value" style={{ color: "var(--low)" }}>
                    {data.by_status["resolved"] ?? 0}
                  </div>
                </div>
                <div className={`stat-card ${data.sla_risk_count > 0 ? "sla-risk" : ""}`}>
                  <div className="stat-label">⚠ SLA Risk</div>
                  <div className={`stat-value ${data.sla_risk_count > 0 ? "danger" : ""}`}>
                    {data.sla_risk_count}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    threshold: {data.sla_threshold_hours}h
                  </div>
                </div>
              </div>

              {/* By Status */}
              <div className="breakdown-section">
                <div className="breakdown-title">By Status</div>
                <div className="breakdown-grid">
                  {Object.entries(data.by_status).map(([k, v]) => (
                    <div key={k} className="breakdown-item">
                      <div className="breakdown-key">{k.replace("_", " ")}</div>
                      <div className="breakdown-val">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Category */}
              <div className="breakdown-section">
                <div className="breakdown-title">By Category</div>
                <div className="breakdown-grid">
                  {Object.keys(data.by_category).length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No triage data yet — run triage on tickets first.</div>
                  ) : (
                    Object.entries(data.by_category).map(([k, v]) => (
                      <div key={k} className="breakdown-item">
                        <div className="breakdown-key">{k.replace("_", " ")}</div>
                        <div className="breakdown-val">{v}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* By Priority */}
              <div className="breakdown-section">
                <div className="breakdown-title">By Priority</div>
                <div className="breakdown-grid">
                  {Object.keys(data.by_priority).length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Run triage to see priority breakdown.</div>
                  ) : (
                    (["critical", "high", "medium", "low"] as const)
                      .filter((k) => data.by_priority[k] !== undefined)
                      .map((k) => (
                        <div key={k} className="breakdown-item" style={{ borderColor: priorityBorder(k) }}>
                          <div className="breakdown-key" style={{ color: priorityColor(k) }}>{k}</div>
                          <div className="breakdown-val">{data.by_priority[k]}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function priorityColor(p: string) {
  return { critical: "var(--critical)", high: "var(--high)", medium: "var(--medium)", low: "var(--low)" }[p] ?? "var(--text-primary)";
}

function priorityBorder(p: string) {
  return { critical: "rgba(240,62,62,0.25)", high: "rgba(247,103,7,0.25)", medium: "rgba(245,159,0,0.25)", low: "rgba(55,178,77,0.25)" }[p] ?? "var(--border)";
}
