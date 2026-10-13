import type { Fact } from "../schemas";

export type ScoredFact = { fact: Fact; score: number };

/** Where a user's embedded facts live. In-memory for tests/evals; pgvector in the app. */
export interface FactStore {
  upsert(userId: string, items: { fact: Fact; vector: number[] }[]): Promise<void>;
  search(userId: string, vector: number[], k: number): Promise<ScoredFact[]>;
  all(userId: string): Promise<Fact[]>;
}

export class InMemoryFactStore implements FactStore {
  private readonly byUser = new Map<string, Map<string, { fact: Fact; vector: number[] }>>();

  async upsert(userId: string, items: { fact: Fact; vector: number[] }[]) {
    const m = this.byUser.get(userId) ?? new Map();
    for (const it of items) m.set(it.fact.id, it);
    this.byUser.set(userId, m);
  }

  async search(userId: string, vector: number[], k: number) {
    const items = [...(this.byUser.get(userId)?.values() ?? [])];
    return items
      .map(({ fact, vector: v }) => ({ fact, score: cosine(vector, v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async all(userId: string) {
    return [...(this.byUser.get(userId)?.values() ?? [])].map((x) => x.fact);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
