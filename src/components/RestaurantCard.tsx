import { Button } from "@/components/ui/button";
import type { ScoredRestaurant, DialState } from "@/lib/veda";
import { ExternalLink, Sparkles, ShieldCheck, Flame, Utensils, CheckCircle2, AlertTriangle, Star, Leaf, Gem } from "lucide-react";
import { recordOutcome } from "@/lib/memory";
import { toast } from "sonner";
import { useState } from "react";
import { buildMealPlate } from "@/lib/pairings";
import { getSocialProof, getDishSentiment, reconciliationNote } from "@/lib/socialProof";

const purityLabel: Record<string, string> = {
  sovereign: "Organic",
  conscious: "Natural",
  satellite: "Standard",
};

export const RestaurantCard = ({ item, rank, dials }: { item: ScoredRestaurant; rank: number; dials: DialState }) => {
  const { restaurant: r, score, why, promo } = item;
  const plate = buildMealPlate(r, score, dials);
  const inferenceTags = item.inferenceTags ?? [];
  const isTop = rank === 0;
  const [handoff, setHandoff] = useState<null | "doordash" | "ubereats">(null);
  const [integrity, setIntegrity] = useState<null | "organic" | "natural" | "off">(null);
  const [tusti, setTusti] = useState<number>(0);

  const proof = getSocialProof(r.id);
  const sentimentDish = plate?.base.verified ? plate.base.name : r.signature_dish;
  const sentiment = getDishSentiment(r.id, sentimentDish, proof.avg);
  const reconciled = reconciliationNote(proof, sentiment);

  const handleOrder = (platform: "doordash" | "ubereats", url: string | null) => {
    setHandoff(platform);
    recordOutcome(r.id, r.cuisine, 4);
    toast("Leaving Rasaoi — Restaurant / Platform terms now apply.", {
      description: `Handoff to ${platform === "doordash" ? "DoorDash" : "Uber Eats"} for ${r.name}.`,
    });
    setTimeout(() => {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      setHandoff(null);
    }, 900);
  };

  return (
    <article
      className={`relative rounded-sm border bg-card p-8 transition-elegant ${
        isTop ? "border-gold shadow-elegant" : "border-border/60 shadow-soft hover:shadow-elegant hover:border-gold/40"
      }`}
    >
      {isTop && (
        <div className="absolute -top-3 left-8 px-3 py-1 bg-gradient-gold text-gold-foreground text-[10px] uppercase tracking-[0.25em] font-semibold rounded-sm flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Well-Wisher's Top Choice
        </div>
      )}

      <div className="flex items-start justify-between gap-6 mb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground flex-wrap">
            <span>{r.cuisine}</span>
            <span className="w-1 h-1 rounded-full bg-gold" />
            <span className="text-gold font-medium">{purityLabel[r.purity_tier]}</span>
            <span className="w-1 h-1 rounded-full bg-gold" />
            <span>{"$".repeat(r.price_tier)}</span>
            {r.sovereign_seal && (
              <span className="flex items-center gap-1 text-gold font-semibold">
                <ShieldCheck className="w-3 h-3" /> Sovereign Seal
              </span>
            )}
          </div>
          <h2 className="serif text-3xl text-primary">{r.name}</h2>
          <p className="serif text-xl text-foreground/80 italic">{r.signature_dish}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="serif text-5xl text-gold leading-none font-semibold">{score}<span className="text-2xl">%</span></div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/80 mt-1.5 font-semibold">Match</div>
        </div>
      </div>

      {inferenceTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {inferenceTags.map((t) => (
            <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm border border-border/60">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Social Proof Row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-5 px-3 py-2.5 rounded-sm border border-border/60 bg-secondary/30">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="uppercase tracking-wider text-[9px] text-muted-foreground font-semibold">Google</span>
          <span className="font-semibold text-foreground">{proof.google.toFixed(1)}</span>
          <Star className="w-3 h-3 fill-gold text-gold" />
        </div>
        <span className="w-px h-3 bg-border/60" />
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="uppercase tracking-wider text-[9px] text-muted-foreground font-semibold">Yelp</span>
          <span className="font-semibold text-foreground">{proof.yelp.toFixed(1)}</span>
          <Star className="w-3 h-3 fill-gold text-gold" />
        </div>
        <span className="w-px h-3 bg-border/60" />
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="uppercase tracking-wider text-[9px] text-muted-foreground font-semibold">TripAdvisor</span>
          <span className="font-semibold text-foreground">{proof.tripadvisor.toFixed(1)}</span>
          <Star className="w-3 h-3 fill-gold text-gold" />
        </div>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          {proof.reviewCount.toLocaleString()}+ reviews
        </span>
        {sentiment.hiddenGem && (
          <span className="w-full flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-gold font-semibold pt-1 border-t border-border/40">
            <Gem className="w-3 h-3" /> Veda Hidden Gem · {sentiment.positivePct}% positive on the {sentiment.dish}
          </span>
        )}
      </div>

      {promo && (
        <div className="mb-4 bg-gradient-gold text-gold-foreground px-3 py-2.5 rounded-sm">
          <div className="flex items-center gap-2 mb-0.5">
            <Flame className="w-3.5 h-3.5" />
            <span className="font-bold uppercase tracking-wider text-[10px]">Flash Deal</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">· {promo.label}</span>
            {(promo as typeof promo & { promo_code?: string | null }).promo_code && (
              <span className="ml-auto text-[10px] font-mono bg-gold-foreground/15 px-2 py-0.5 rounded-sm">
                {(promo as typeof promo & { promo_code?: string | null }).promo_code}
              </span>
            )}
          </div>
          {(promo as typeof promo & { description?: string | null }).description && (
            <p className="text-[11px] opacity-95 leading-snug">
              {(promo as typeof promo & { description?: string | null }).description}
            </p>
          )}
        </div>
      )}

      <div className="border-l-2 border-gold/60 pl-5 py-2 my-6 bg-gold-soft/30 rounded-r-sm">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold font-semibold mb-2">
          <Sparkles className="w-3 h-3" />
          A Note from your Well-Wisher
        </div>
        <p className="text-sm leading-relaxed text-foreground/85">{why}</p>
        <p className="text-[12px] text-foreground/75 italic mt-2 leading-relaxed border-t border-gold/20 pt-2">
          {reconciled}
        </p>
        <p className="text-[10px] text-muted-foreground italic mt-2">
          Oil: {r.oil_profile} · Grain: {r.grain_profile}
        </p>
      </div>

      {plate && (
        <div className="border border-gold/40 bg-card rounded-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
              <Utensils className="w-3 h-3" />
              Recommended Plate
              <span className="ml-2 px-2 py-0.5 rounded-sm bg-gold-soft/60 text-gold normal-case tracking-normal text-[10px] font-medium">
                Dish Sentiment {sentiment.positivePct}%
              </span>
            </div>
            <div className="text-right">
              <div className="serif text-2xl text-gold leading-none">{plate.totalOutcomeScore}</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Total Outcome</div>
            </div>
          </div>

          {(() => {
            const items = [plate.base, ...(plate.carrier ? [plate.carrier] : []), ...(plate.booster ? [plate.booster] : [])];
            return (
              <div className="border border-gold/30 rounded-sm overflow-hidden mb-4 bg-gradient-to-br from-secondary/30 to-card">
                <div className="px-4 py-2 bg-gold-soft/40 border-b border-gold/30 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">Complete Plate</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {items.length} component{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="divide-y divide-border/40">
                  {items.map((item, idx) => (
                    <div key={item.name} className="flex items-start gap-3 px-4 py-3">
                      <div className="serif text-xl text-gold/70 leading-none w-5 shrink-0 mt-0.5">
                        {idx === 0 ? "I" : idx === 1 ? "II" : "III"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[9px] uppercase tracking-[0.2em] text-gold font-semibold">{item.role}</span>
                          {item.sovereign ? (
                            <CheckCircle2 className="w-3 h-3 text-gold" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className={`text-[9px] uppercase tracking-wider font-semibold ml-auto ${
                            item.verified ? "text-gold/80" : item.inferred ? "text-foreground/60" : "text-muted-foreground"
                          }`}>
                            {item.verified ? "✓ Menu Verified" : item.inferred ? "✦ Inferred Staple" : "○ Pending"}
                          </span>
                        </div>
                        <div className="serif text-base text-primary leading-tight">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 italic">{item.outcome}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {plate.whyConstruction && (
            <p className="text-[12px] text-foreground/80 italic mb-3 leading-relaxed">
              {plate.whyConstruction}
            </p>
          )}

          <div className="flex items-start gap-2 text-[11px] text-foreground/75 leading-relaxed border-t border-border/40 pt-3">
            <ShieldCheck className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
            <div>
              <span className="text-gold font-semibold uppercase tracking-wider text-[9px]">Integrity Check</span>
              <p className="mt-0.5">{plate.integrityNote}</p>
              <p className="mt-1.5 text-foreground/85">{plate.totalOutcome}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => handleOrder("doordash", r.doordash_url)}
          disabled={handoff !== null}
          className="bg-primary hover:bg-primary/90 rounded-sm"
        >
          {handoff === "doordash" ? "Handoff…" : "DoorDash"} <ExternalLink className="w-3 h-3 ml-2" />
        </Button>
        <Button
          variant="outline"
          onClick={() => handleOrder("ubereats", r.ubereats_url)}
          disabled={handoff !== null}
          className="border-primary/30 hover:bg-secondary rounded-sm"
        >
          {handoff === "ubereats" ? "Handoff…" : "Uber Eats"} <ExternalLink className="w-3 h-3 ml-2" />
        </Button>
      </div>

      {/* Verify the Outcome — Private Feedback Loop */}
      <div className="mt-6 pt-5 border-t border-border/50">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
            Verify the Outcome
          </div>
          <span className="text-[10px] text-muted-foreground italic">Private — improves your Vitality Twin</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Integrity Check */}
          <div className="rounded-sm border border-border/60 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Leaf className="w-3.5 h-3.5 text-gold" />
              <span className="text-[10px] uppercase tracking-wider text-foreground/80 font-semibold">Integrity Check</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">Did it feel Organic / Natural?</p>
            <div className="flex gap-1.5">
              {(["organic", "natural", "off"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setIntegrity(opt);
                    toast(`Integrity logged: ${opt === "off" ? "Off-profile" : opt}`);
                  }}
                  className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition-elegant ${
                    integrity === opt
                      ? "bg-gold text-gold-foreground border-gold"
                      : "bg-card border-border/60 hover:border-gold/60 text-foreground/70"
                  }`}
                >
                  {opt === "off" ? "Off" : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Tusti — Taste Satisfaction */}
          <div className="rounded-sm border border-border/60 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-3.5 h-3.5 text-gold" />
              <span className="text-[10px] uppercase tracking-wider text-foreground/80 font-semibold">Tusti · Taste Satisfaction</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">How satisfying was the meal?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setTusti(n);
                    recordOutcome(r.id, r.cuisine, n);
                    toast(`Tusti recorded: ${n}/5`);
                  }}
                  className="p-0.5 transition-elegant"
                  aria-label={`Rate ${n}`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      n <= tusti ? "fill-gold text-gold" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
