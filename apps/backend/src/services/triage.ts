import { RawLLMOutput, RawLLMOutputSchema, Ticket } from "../models/schemas";

// ─── Keyword rules for mock mode ──────────────────────────────────────────────

const RULES: Array<{
  keywords: string[];
  output: Omit<RawLLMOutput, "explanation" | "suggested_reply">;
}> = [
  {
    keywords: ["crash", "error", "broken", "not working", "bug", "fail", "exception"],
    output: {
      category: "bug",
      sentiment: "frustrated",
      urgency: "critical",
      priority: "critical",
      confidence: 0.9,
      tone: "empathetic",
    },
  },
  {
    keywords: ["data loss", "lost data", "missing data", "deleted", "corrupt"],
    output: {
      category: "bug",
      sentiment: "frustrated",
      urgency: "critical",
      priority: "critical",
      confidence: 0.95,
      tone: "empathetic",
    },
  },
  {
    keywords: ["charge", "invoice", "refund", "billing", "payment", "double charged", "overcharged"],
    output: {
      category: "billing",
      sentiment: "negative",
      urgency: "high",
      priority: "high",
      confidence: 0.88,
      tone: "professional",
    },
  },
  {
    keywords: ["locked out", "can't login", "cannot login", "password reset", "account access", "login issue"],
    output: {
      category: "account_access",
      sentiment: "frustrated",
      urgency: "high",
      priority: "high",
      confidence: 0.87,
      tone: "empathetic",
    },
  },
  {
    keywords: ["feature", "would be great", "suggestion", "request", "add support for", "wish", "could you add"],
    output: {
      category: "feature_request",
      sentiment: "positive",
      urgency: "low",
      priority: "low",
      confidence: 0.82,
      tone: "friendly",
    },
  },
];

// ─── Reply templates ──────────────────────────────────────────────────────────

function buildReply(name: string, category: string, urgency: string): string {
  const greeting = `Hi ${name},\n\nThank you for reaching out to our support team.`;

  const bodies: Record<string, string> = {
    bug: `We're sorry to hear you're experiencing issues. We've flagged this as ${urgency} priority and our engineering team has been notified. We'll keep you updated as we investigate.`,
    billing: `We understand billing issues can be stressful. We've escalated your case to our billing team and will review your account within 1 business day. If there was an error, we'll issue a full correction.`,
    account_access: `We know being locked out is frustrating. Please try resetting your password using the link below. If that doesn't work, reply to this message and we'll manually verify your account within a few hours.`,
    feature_request: `Thanks for the great suggestion! We've logged your feature request and shared it with our product team. We review requests regularly and appreciate your feedback.`,
    general: `We've received your message and will get back to you shortly. In the meantime, you can browse our Help Center at help.example.com for quick answers.`,
  };

  const closing = `\nBest regards,\nSupport Team`;

  return `${greeting}\n\n${bodies[category] ?? bodies.general}${closing}`;
}

// ─── Explanation templates ────────────────────────────────────────────────────

function buildExplanation(category: string, urgency: string, confidence: number): string {
  const conf = Math.round(confidence * 100);
  return `Classified as ${category.replace("_", " ")} with ${urgency} urgency (${conf}% confidence) based on message content analysis. ${
    confidence < 0.6
      ? "Low confidence — recommend manual review before accepting draft."
      : "Confidence is sufficient for automated classification."
  }`;
}

// ─── Triage Service ───────────────────────────────────────────────────────────

export class TriageService {
  private provider: string;

  constructor() {
    this.provider = process.env.LLM_PROVIDER ?? "mock";
  }

  async triage(ticket: Ticket): Promise<RawLLMOutput> {
    if (this.provider === "mock") {
      return this.mockTriage(ticket);
    }
    // TODO: wire real LLM providers here
    // if (this.provider === "openai") return this.openaiTriage(ticket);
    // if (this.provider === "gemini") return this.geminiTriage(ticket);
    return this.mockTriage(ticket);
  }

  private mockTriage(ticket: Ticket): RawLLMOutput {
    const text = `${ticket.subject} ${ticket.message}`.toLowerCase();

    let matched = RULES.find((rule) =>
      rule.keywords.some((kw) => text.includes(kw))
    );

    // Default fallback
    const base = matched?.output ?? {
      category: "general" as const,
      sentiment: "neutral" as const,
      urgency: "low" as const,
      priority: "low" as const,
      confidence: 0.55,
      tone: "professional",
    };

    const raw: RawLLMOutput = {
      ...base,
      explanation: buildExplanation(base.category, base.urgency, base.confidence),
      suggested_reply: buildReply(ticket.customer_name, base.category, base.urgency),
    };

    // Validate through Zod before returning
    const parsed = RawLLMOutputSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("⚠️  Triage output failed validation:", parsed.error.format());
      // Return a safe fallback
      return {
        category: "general",
        sentiment: "neutral",
        urgency: "low",
        priority: "low",
        confidence: 0.4,
        explanation: "Unable to classify — low confidence fallback. Please review manually.",
        suggested_reply: buildReply(ticket.customer_name, "general", "low"),
        tone: "professional",
      };
    }

    return parsed.data;
  }
}

export const triageService = new TriageService();
