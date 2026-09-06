/**
 * ROE-027 — Softmax alternate ordering + light Pareto front filter.
 * Does not invent venues or dishes — only reorders / drops dominated candidates.
 */

/** Softmax probabilities from scores (higher = more mass). Temperature softens peaks. */
export function softmaxWeights(scores: number[], temperature = 10): number[] {
  if (!scores.length) return [];
  const t = Math.max(0.5, temperature);
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

/** Indices sorted by softmax weight descending (deterministic). */
export function rankIndicesBySoftmax(scores: number[], temperature = 10): number[] {
  const w = softmaxWeights(scores, temperature);
  return w
    .map((weight, i) => ({ i, weight }))
    .sort((a, b) => b.weight - a.weight || b.i - a.i)
    .map((x) => x.i);
}

/**
 * Re-order alternates by softmax on venue score, then lightly diversify by cuisine
 * so MiniCards are less clone-heavy. Preserves all items up to `limit`.
 */
export function orderAlternatesSoftmax<
  T extends { score: number; restaurant: { id: string; cuisine: string } },
>(alternates: T[], limit = 6, temperature = 10): T[] {
  if (alternates.length <= 1) return alternates.slice(0, limit);
  const scores = alternates.map((a) => a.score);
  const order = rankIndicesBySoftmax(scores, temperature);
  const ranked = order.map((i) => alternates[i]);

  const out: T[] = [];
  const seenCuisine = new Set<string>();
  // Pass 1: prefer new cuisines while following softmax order
  for (const item of ranked) {
    if (out.length >= limit) break;
    const c = (item.restaurant.cuisine || "").toLowerCase();
    if (c && seenCuisine.has(c) && out.length + 1 < limit) continue;
    out.push(item);
    if (c) seenCuisine.add(c);
  }
  // Pass 2: fill remaining slots in softmax order
  for (const item of ranked) {
    if (out.length >= limit) break;
    if (out.some((x) => x.restaurant.id === item.restaurant.id)) continue;
    out.push(item);
  }
  return out;
}

/** True if point `a` is weakly dominated by `b` (all dims ≤, strict in ≥1). Maximize all dims. */
export function isDominatedBy(a: number[], b: number[]): boolean {
  if (a.length !== b.length || !a.length) return false;
  let strict = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return false;
    if (a[i] < b[i]) strict = true;
  }
  return strict;
}

/** Keep only non-dominated items (Pareto front). Empty objectives → keep all. */
export function paretoFront<T>(items: T[], objectives: (item: T) => number[]): T[] {
  if (items.length <= 1) return [...items];
  return items.filter((item, i) => {
    const oi = objectives(item);
    if (!oi.length) return true;
    return !items.some((other, j) => j !== i && isDominatedBy(oi, objectives(other)));
  });
}

/**
 * Among plate name candidates, drop those dominated on Ask-align + spice soft axes.
 * Always keeps at least one candidate (falls back to original list).
 */
export function filterPlateCandidatesPareto<T extends { name: string }>(
  candidates: T[],
  scoreOf: (c: T) => { ask: number; spice: number },
): T[] {
  if (candidates.length <= 1) return candidates;
  const front = paretoFront(candidates, (c) => {
    const s = scoreOf(c);
    return [s.ask, s.spice];
  });
  return front.length ? front : candidates;
}
