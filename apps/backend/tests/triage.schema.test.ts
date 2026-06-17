import { describe, it, expect } from "vitest";
import { RawLLMOutputSchema } from "../src/models/schemas";

describe("RawLLMOutputSchema — triage output validation", () => {
  const validOutput = {
    category: "billing",
    sentiment: "frustrated",
    urgency: "high",
    priority: "high",
    confidence: 0.88,
    explanation: "Customer reports a double charge — financial impact.",
    suggested_reply: "Hi Sarah, we are sorry for the confusion with your billing.",
    tone: "empathetic",
  };

  it("accepts a fully valid triage output", () => {
    const result = RawLLMOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects missing category field", () => {
    const { category: _omit, ...rest } = validOutput;
    const result = RawLLMOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid category value", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, category: "unknown_cat" });
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects empty explanation", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, explanation: "no" });
    expect(result.success).toBe(false); // min 5 chars
  });

  it("rejects too-short suggested_reply", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, suggested_reply: "ok" });
    expect(result.success).toBe(false); // min 10 chars
  });

  it("rejects invalid urgency value", () => {
    const result = RawLLMOutputSchema.safeParse({ ...validOutput, urgency: "extreme" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid category values", () => {
    const categories = ["billing", "bug", "feature_request", "account_access", "general"];
    for (const category of categories) {
      const result = RawLLMOutputSchema.safeParse({ ...validOutput, category });
      expect(result.success, `Expected ${category} to be valid`).toBe(true);
    }
  });

  it("accepts confidence of exactly 0 and 1", () => {
    expect(RawLLMOutputSchema.safeParse({ ...validOutput, confidence: 0 }).success).toBe(true);
    expect(RawLLMOutputSchema.safeParse({ ...validOutput, confidence: 1 }).success).toBe(true);
  });
});
