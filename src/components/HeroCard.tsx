import { Button } from "@/components/ui/button";
import type { ScoredRestaurant, DialState } from "@/lib/veda";
import { buildMealPlate, buildTripleOutcome, type IntentHint } from "@/lib/pairings";
import { TripleOutcome } from "./TripleOutcome";
import { Sparkles, Leaf, Battery, Star, Flame, UtensilsCrossed, Droplet } from "lucide-react";
import { useState } from "react";
import { getSocialProof } from "@/lib/socialProof";
import { FulfillmentSheet } from "./FulfillmentSheet";
import { glColorClass, glLabel, suggestCarrierSwap, type GLEstimate } from "@/lib/glycemic";

// 3 semantic tags in <=10 words total — picked from inferenceTags + purity.
function buildSemanticTags(item: ScoredRestaurant): { icon: typeof Leaf; label: string }[] {
  const tags = item.inferenceTags ?? [];
  const purity = item.restaurant.purity_tier;
  const tagPool: { icon: typeof Leaf; label: string }[] = [];

  // Slot 1: Purity
  if (purity === "sovereign") tagPool.push({ icon: Leaf, label: "Good for you" });
  else if (purity === "conscious") tagPool.push({ icon: Leaf, label: "Natural Sourced" });
  else tagPool.push({ icon: Leaf, label: "Standard Kitchen" });

  // Slot 2: Energy intent
  if (tags.includes("Anti-Inflammatory") || tags.includes("Grounding & Warm"))
    tagPool.push({ icon: Battery, label: "Deep Recovery" });
  else if (tags.includes("Peak-State Fuel"))
    tagPool.push({ icon: Battery, label: "Peak Fuel" });
  else tagPool.push({ icon: Battery, label: "Balanced Energy" });

  // Slot 3: Social proof / promo
  if (tags.includes("Flash Deal")) tagPool.push({ icon: Flame, label: "Flash Deal" });
  else tagPool.push({ icon: Star, label: "Local Favorite" });

  return tagPool.slice(0, 3);
}

// Dish-level "Good for you": high-integrity fats (ghee/butter) or seed-oil-free,
// even if the whole restaurant isn't sovereign-tier.
function dishIsGoodForYou(item: ScoredRestaurant): boolean {
  const r = item.restaurant;
  if (r.purity_tier === "sovereign") return true;
  if (r.oil_profile === "seed-oil-free" || r.oil_profile === "cold-pressed") return true;
  const sig = (r.signature_dish ?? "").toLowerCase();
  const outcome = ((r.dish_outcome ?? "") + " " + sig).toLowerCase();
  if (/\bghee\b|\bbutter\b|cold[- ]pressed|grass[- ]fed/.test(outcome)) return true;
  return false;
}

function buildShortInsight(
  item: ScoredRestaurant,
  dials: DialState,
  selectedDish?: string,
  dietary?: IntentHint["dietary"],
): string {
  const dish = selectedDish ?? item.restaurant.signature_dish ?? "this dish";
  const r = item.restaurant;
  const energyNote = dials.energy < 40 ? "current low energy" : dials.energy > 70 ? "peak energy state" : "current state";
  if (dietary === "jain") {
    return `Chosen because ${dish} is Jain-compliant — prepared without meat, eggs, onion, garlic, or root vegetables — ideal for your ${energyNote} and celebratory context.`;
  }
  if (dietary === "vegan") {
    return `Chosen because ${dish} is fully plant-based with no animal products or dairy — aligned to your ${energyNote}.`;
  }
  if (dietary === "vegetarian") {
    return `Chosen because ${dish} is vegetarian with no meat, fish, or eggs — suited to your ${energyNote}.`;
  }
  if (dietary === "eggetarian") {
    return `Chosen because ${dish} fits an eggetarian diet (no meat; eggs allowed) for your ${energyNote}.`;
  }
  const fat = r.oil_profile === "seed-oil-free"
    ? "seed-oil-free preparation"
    : r.oil_profile === "cold-pressed"
      ? "cold-pressed oils"
      : /ghee|butter/i.test(r.dish_outcome ?? "") ? "Ghee" : "clean preparation";
  return `Chosen because ${dish} uses ${fat} and high-protein prep, making it the best outcome for your ${energyNote}.`;
}

export const HeroCard = ({ item, dials, vitality, intent, gl }: { item: ScoredRestaurant; dials: DialState; vitality: number | null; intent?: IntentHint; gl?: GLEstimate }) => {
  const { restaurant: r, score, promo } = item;
  const plate = buildMealPlate(r, score, dials, intent?.dietary);
  const proof = getSocialProof(r.id);
  const semanticTags = buildSemanticTags(item);
  const picks = buildTripleOutcome(r, dials, intent);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const selected = picks[selectedIdx] ?? picks[0];
  const dishLabel = selected
    ? selected.carrier ? `${selected.dish} + ${selected.carrier}` : selected.dish
    : r.signature_dish;
  const swap = gl && (gl.glycemic_load === "med" || gl.glycemic_load === "high")
    ? (suggestCarrierSwap(selected?.carrier) ?? (gl.swap_suggestion ? { replacement: gl.swap_suggestion, rationale: "lower glycemic load" } : null))
    : null;

  return (
    <article className="relative rounded-sm border-2 border-gold bg-card p-7 sm:p-9 pt-9 sm:pt-11 shadow-elegant overflow-visible">
      {/* Top Choice Badge */}
      <div className="absolute -top-3 left-7 z-10 px-3 py-1 bg-gradient-gold text-gold-foreground text-[10px] uppercase tracking-[0.25em] font-semibold rounded-sm flex items-center gap-1.5 shadow-md">
        <Sparkles className="w-3 h-3" /> Well-Wisher's Top Choice
      </div>

      {/* Header — small restaurant name + dominant match score */}
      <div className="flex items-start justify-between gap-5 mb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>{r.cuisine}</span>
            <span className="w-1 h-1 rounded-full bg-gold" />
            <span>{"$".repeat(r.price_tier)}</span>
            <span className="w-1 h-1 rounded-full bg-gold" />
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-gold text-gold" />
              {proof.avg.toFixed(1)}
            </span>
          </div>
          <div className="text-sm uppercase tracking-[0.18em] text-muted-foreground/90 font-medium truncate">
            {r.name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="serif text-5xl sm:text-6xl text-gold leading-none font-semibold">
            {score}<span className="text-2xl sm:text-3xl">%</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/80 mt-1.5 font-semibold">Match</div>
        </div>
      </div>

      {/* THE THREE OUTCOMES — strategic dish pairings (tap to choose) */}
      <div className="mb-5">
        <TripleOutcome
          picks={picks}
          size="md"
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {dishIsGoodForYou(item) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] uppercase tracking-wider font-semibold">
              <Leaf className="w-3 h-3" /> Good for you
            </span>
          )}
          {gl && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] uppercase tracking-wider font-semibold ${glColorClass(gl.glycemic_load)}`}
              title={`${gl.carbs_g}g carbs · ${gl.why}`}
            >
              <Droplet className="w-3 h-3" /> {glLabel(gl.glycemic_load)}
            </span>
          )}
        </div>
        {gl?.why && (
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            {gl.why}{gl.added_sugar ? " · contains added sugar" : ""}
          </p>
        )}
        {swap && (
          <p className="text-[11px] text-emerald-800 mt-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Swap:</span>{" "}
            {swap.replacement} <span className="text-muted-foreground italic">— {swap.rationale}</span>
          </p>
        )}
      </div>

      {/* Short & crisp insight */}
      <p className="text-sm text-foreground/85 leading-relaxed mb-5 italic">
        {buildShortInsight(item, dials, selected?.dish, intent?.dietary)}
      </p>

      {plate?.integrityNote && (
        <p className="text-[10px] text-muted-foreground/80 italic mb-4">
          {plate.integrityNote}
        </p>
      )}

      {/* Tag chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {semanticTags.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-sm bg-gold-soft/50 text-primary border border-gold/30 font-medium"
          >
            <Icon className="w-3 h-3 text-gold" /> {label}
          </span>
        ))}
      </div>

      {promo && (
        <div className="mb-5 bg-gradient-gold text-gold-foreground px-3 py-2 rounded-sm flex items-center gap-2 text-[11px]">
          <Flame className="w-3.5 h-3.5" />
          <span className="font-bold uppercase tracking-wider text-[10px]">Flash Deal</span>
          <span className="opacity-90">· {promo.label}</span>
        </div>
      )}

      <Button
        onClick={() => setSheetOpen(true)}
        className="w-full bg-primary hover:bg-primary/90 rounded-sm h-12 text-sm"
      >
        <UtensilsCrossed className="w-4 h-4 mr-2" />
        Continue with {selected?.dish ?? "this outcome"}
      </Button>

      <FulfillmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={item}
        dish={dishLabel ?? r.signature_dish}
        rank={selectedIdx + 1}
        dials={dials}
        vitality={vitality}
      />
    </article>
  );
};
