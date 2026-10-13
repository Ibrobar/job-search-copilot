import type { ChatMessage, LlmClient, LlmUsage } from "@jsc/core";
import type { z } from "zod";

export class BudgetExceededError extends Error {}

/** Shared token meter across clients: one hard cap for the whole eval run. */
export class TokenMeter {
  readonly calls: (LlmUsage & { role: string })[] = [];
  constructor(readonly maxTokens: number) {}

  get total() {
    return this.calls.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0);
  }

  record(role: string, usage: LlmUsage) {
    this.calls.push({ ...usage, role });
    if (this.total > this.maxTokens) {
      throw new BudgetExceededError(`Token cap hit: ${this.total} > ${this.maxTokens}`);
    }
  }

  check() {
    if (this.total > this.maxTokens) throw new BudgetExceededError(`Token cap hit: ${this.total} > ${this.maxTokens}`);
  }
}

export function metered(inner: LlmClient, meter: TokenMeter, role: string): LlmClient {
  return {
    async chatJson<T>(args: { schema: z.ZodType<T>; schemaName: string; messages: ChatMessage[] }) {
      meter.check();
      const res = await inner.chatJson(args);
      meter.record(role, res.usage);
      return res;
    },
    async embed(texts: string[]) {
      meter.check();
      const res = await inner.embed(texts);
      meter.record(`${role}:embed`, res.usage);
      return res;
    },
  };
}
