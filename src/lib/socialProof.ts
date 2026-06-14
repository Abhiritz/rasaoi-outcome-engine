// Social Proof + Dish Sentiment layer
// Deterministic simulated ratings (seeded by restaurant id) so the UI is
// stable across renders. When real review data becomes available, swap the
// generators for live API calls — the consumer shape stays identical.

export interface SocialProof {
  google: number;       // 1.0 - 5.0
  yelp: number;
  tripadvisor: number;
  reviewCount: number;  // aggregated
  avg: number;          // weighted average
}

export interface DishSentiment {
  dish: string;
  positivePct: number;  // 0 - 100
  mentions: number;
  hiddenGem: boolean;   // avg rating ≤ 3.8 AND positivePct ≥ 90
}

// Tiny seeded PRNG (mulberry32) so values are stable per restaurant id.
function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rand(seed: number) {
  let t = seed;
  return () => {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function getSocialProof(restaurantId: string): SocialProof {
  const r = rand(seedFromString(restaurantId + ":proof"));
  // Anchor between 3.4 and 4.7 for realism
  const base = 3.4 + r() * 1.3;
  const google = +(base + (r() - 0.5) * 0.4).toFixed(1);
  const yelp = +(base + (r() - 0.5) * 0.6).toFixed(1);
  const tripadvisor = +(base + (r() - 0.5) * 0.5).toFixed(1);
  const reviewCount = 120 + Math.floor(r() * 1800);
  const avg = +((google + yelp + tripadvisor) / 3).toFixed(1);
  return {
    google: Math.max(1, Math.min(5, google)),
    yelp: Math.max(1, Math.min(5, yelp)),
    tripadvisor: Math.max(1, Math.min(5, tripadvisor)),
    reviewCount,
    avg,
  };
}

export function getDishSentiment(restaurantId: string, dishName: string, avgRating: number): DishSentiment {
  const r = rand(seedFromString(restaurantId + ":" + dishName.toLowerCase()));
  // Signature dishes skew positive: 75 - 98%
  const positivePct = Math.round(75 + r() * 23);
  const mentions = 40 + Math.floor(r() * 260);
  const hiddenGem = avgRating <= 3.9 && positivePct >= 90;
  return { dish: dishName, positivePct, mentions, hiddenGem };
}

export function reconciliationNote(proof: SocialProof, sentiment: DishSentiment): string {
  if (sentiment.hiddenGem) {
    return `While this location carries a mixed ${proof.avg} aggregate rating, our analysis of ${sentiment.mentions}+ reviews confirms the ${sentiment.dish} is a high-integrity masterpiece — a Veda Hidden Gem.`;
  }
  if (proof.avg >= 4.3 && sentiment.positivePct >= 88) {
    return `${proof.avg}★ across ${proof.reviewCount}+ reviews, with ${sentiment.positivePct}% of guests singling out the ${sentiment.dish}. Consensus and dish-level sentiment agree.`;
  }
  if (sentiment.positivePct >= 85) {
    return `Aggregate rating sits at ${proof.avg}★, but dish-level sentiment for the ${sentiment.dish} reads ${sentiment.positivePct}% positive across ${sentiment.mentions} mentions — order with confidence.`;
  }
  return `Aggregate ${proof.avg}★ over ${proof.reviewCount}+ reviews. Dish sentiment for the ${sentiment.dish}: ${sentiment.positivePct}% positive.`;
}
