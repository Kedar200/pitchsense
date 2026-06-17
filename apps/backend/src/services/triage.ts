import { RawLLMOutput, RawLLMOutputSchema, Ticket } from "../models/schemas";

const OPENROUTER_MODEL = "openai/gpt-4o-mini";

function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function logResult(source: string, ticket: Ticket, output: RawLLMOutput, startedAt: number): void {
  console.info(
    `[triage] completed source=${source} ticket_id=${ticket.id} duration_ms=${Date.now() - startedAt} ` +
      `category=${output.category} urgency=${output.urgency} priority=${output.priority} ` +
      `confidence=${output.confidence} tone=${output.tone}`
  );
}

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
  async triage(ticket: Ticket): Promise<RawLLMOutput> {
    const startedAt = Date.now();
    const provider = process.env.LLM_PROVIDER ?? "mock";

    console.info(
      `[triage] started ticket_id=${ticket.id} status=${ticket.status} provider=${provider} ` +
        `subject="${truncate(ticket.subject)}"`
    );

    if (provider === "openrouter") {
      try {
        const output = await this.openRouterTriage(ticket);
        logResult("openrouter", ticket, output, startedAt);
        return output;
      } catch (err) {
        console.error(
          `[triage] openrouter_failed ticket_id=${ticket.id} duration_ms=${Date.now() - startedAt} ` +
            `error="${formatError(err)}"`
        );
        throw err;
      }
    }

    const output = this.mockTriage(ticket);
    logResult("mock", ticket, output, startedAt);
    return output;
  }

  private async openRouterTriage(ticket: Ticket): Promise<RawLLMOutput> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set in environment");
    }

    console.info(
      `[triage] openrouter_request ticket_id=${ticket.id} model=${OPENROUTER_MODEL} ` +
        `api_key_present=${Boolean(apiKey)}`
    );

    const systemPrompt = `You are an AI customer support triage agent. Your job is to classify incoming support tickets and suggest a reply.
You MUST output strictly in JSON format matching the following schema. Do NOT wrap the JSON in markdown blocks like \`\`\`json. Return only the raw JSON string.

{
  "category": "billing" | "bug" | "feature_request" | "account_access" | "general",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "urgency": "low" | "medium" | "high" | "critical",
  "priority": "low" | "medium" | "high" | "critical",
  "confidence": <number between 0 and 1 indicating your confidence in this classification>,
  "explanation": "<brief explanation of why you chose this classification>",
  "suggested_reply": "<a helpful, empathetic suggested reply draft for the agent to send to the customer>",
  "tone": "<e.g. empathetic, professional, friendly>"
}`;

    const userPrompt = `Ticket from: ${ticket.customer_name}
Subject: ${ticket.subject}
Message: ${ticket.message}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Support Inbox AI Triage",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
      }),
    });

    console.info(
      `[triage] openrouter_response ticket_id=${ticket.id} status=${response.status} ok=${response.ok}`
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${truncate(text, 300)}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from OpenRouter");
    }

    console.info(
      `[triage] openrouter_content ticket_id=${ticket.id} chars=${content.length}`
    );

    let parsedJson;
    try {
      parsedJson = JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to parse JSON from OpenRouter response: ${content}`);
    }

    // Validate the parsed JSON using Zod
    const validated = RawLLMOutputSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error(
        `[triage] openrouter_validation_failed ticket_id=${ticket.id}`,
        validated.error.format()
      );
      throw new Error("Output did not match the required schema");
    }

    console.info(
      `[triage] openrouter_validation_passed ticket_id=${ticket.id} ` +
        `category=${validated.data.category} confidence=${validated.data.confidence}`
    );

    return validated.data;
  }

  private mockTriage(ticket: Ticket): RawLLMOutput {
    const text = `${ticket.subject} ${ticket.message}`.toLowerCase();

    const matched = RULES.find((rule) =>
      rule.keywords.some((kw) => text.includes(kw))
    );

    const matchedKeywords =
      matched?.keywords.filter((kw) => text.includes(kw)).join(", ") || "none";
    console.info(
      `[triage] mock_rule_match ticket_id=${ticket.id} matched=${Boolean(matched)} ` +
        `keywords="${matchedKeywords}"`
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
      console.error(`[triage] mock_validation_failed ticket_id=${ticket.id}`, parsed.error.format());
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
