import type { z } from "zod";
import type { ChatMessage, LlmClient, LlmUsage } from "./types";

const DIMS = 256;

/**
 * Offline client for unit tests and keyless local runs. Embeddings are hashed bag-of-words,
 * so texts sharing words land near each other; chat answers come from the supplied responder.
 */
export class MockLlmClient implements LlmClient {
  readonly calls: ChatMessage[][] = [];

  constructor(private readonly respond: (messages: ChatMessage[]) => unknown = () => ({})) {}

  async chatJson<T>(args: { schema: z.ZodType<T>; schemaName: string; messages: ChatMessage[] }) {
    this.calls.push(args.messages);
    return { data: args.schema.parse(this.respond(args.messages)), usage: usage() };
  }

  async embed(texts: string[]) {
    return { vectors: texts.map(hashEmbed), usage: usage() };
  }
}

function usage(): LlmUsage {
  return { inputTokens: 0, outputTokens: 0, latencyMs: 0, model: "mock" };
}

export function hashEmbed(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
    v[(h >>> 0) % DIMS]! += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}
