import type { z } from "zod";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmUsage = { inputTokens: number; outputTokens: number; latencyMs: number; model: string };

/** Provider-agnostic client. Azure OpenAI in v1; a Claude adapter plugs in later (see CLAUDE.md Decision). */
export interface LlmClient {
  chatJson<T>(args: {
    schema: z.ZodType<T>;
    schemaName: string;
    messages: ChatMessage[];
  }): Promise<{ data: T; usage: LlmUsage }>;
  embed(texts: string[]): Promise<{ vectors: number[][]; usage: LlmUsage }>;
}
