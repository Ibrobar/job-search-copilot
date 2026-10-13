import { DefaultAzureCredential, getBearerTokenProvider, type TokenCredential } from "@azure/identity";
import { AzureOpenAI } from "openai";
import { z } from "zod";
import type { ChatMessage, LlmClient, LlmUsage } from "./types";

export type AzureOpenAiConfig = {
  endpoint: string;
  chatDeployment: string;
  embeddingDeployment: string;
  apiVersion?: string;
  /** Caps output per call. Reasoning models count hidden reasoning tokens against this too. */
  maxOutputTokens?: number;
  /** Retries on 429/5xx with backoff. Evals raise this to ride out rate limits. */
  maxRetries?: number;
  /** Defaults to DefaultAzureCredential: managed identity in Azure, `az login` locally. No API keys. */
  credential?: TokenCredential;
};

export class AzureOpenAiClient implements LlmClient {
  private readonly client: AzureOpenAI;

  constructor(private readonly cfg: AzureOpenAiConfig) {
    const credential = cfg.credential ?? new DefaultAzureCredential();
    this.client = new AzureOpenAI({
      endpoint: cfg.endpoint,
      apiVersion: cfg.apiVersion ?? "2025-04-01-preview",
      maxRetries: cfg.maxRetries ?? 2,
      azureADTokenProvider: getBearerTokenProvider(credential, "https://cognitiveservices.azure.com/.default"),
    });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, overrides: Partial<AzureOpenAiConfig> = {}): AzureOpenAiClient {
    const need = (k: string) => {
      const v = env[k];
      if (!v) throw new Error(`Missing env var ${k}`);
      return v;
    };
    return new AzureOpenAiClient({
      endpoint: need("AZURE_OPENAI_ENDPOINT"),
      chatDeployment: need("AZURE_OPENAI_CHAT_DEPLOYMENT"),
      embeddingDeployment: need("AZURE_OPENAI_EMBEDDING_DEPLOYMENT"),
      ...overrides,
    });
  }

  async chatJson<T>(args: { schema: z.ZodType<T>; schemaName: string; messages: ChatMessage[] }) {
    const started = Date.now();
    const res = await this.client.chat.completions.create({
      model: this.cfg.chatDeployment,
      messages: args.messages,
      max_completion_tokens: this.cfg.maxOutputTokens ?? 6000,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: { name: args.schemaName, strict: true, schema: toStrictJsonSchema(args.schema) },
      },
    });
    const choice = res.choices[0];
    if (!choice?.message.content) throw new Error(`Empty completion (finish_reason=${choice?.finish_reason})`);
    const usage: LlmUsage = {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      model: res.model,
    };
    return { data: args.schema.parse(JSON.parse(choice.message.content)), usage };
  }

  async embed(texts: string[]) {
    const started = Date.now();
    const res = await this.client.embeddings.create({ model: this.cfg.embeddingDeployment, input: texts });
    const usage: LlmUsage = {
      inputTokens: res.usage.prompt_tokens,
      outputTokens: 0,
      latencyMs: Date.now() - started,
      model: res.model,
    };
    return { vectors: res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), usage };
  }
}

/** Structured-outputs strict mode wants every object closed and every property required. */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties) {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
    }
    Object.values(n).forEach((v) => (Array.isArray(v) ? v.forEach(visit) : visit(v)));
  };
  visit(json);
  return json;
}
