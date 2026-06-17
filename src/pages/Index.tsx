import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dial } from "@/components/Dial";
import { HeroCard } from "@/components/HeroCard";
import { MiniCard } from "@/components/MiniCard";
import { CuisineFilter } from "@/components/CuisineFilter";
import { SelfImprovementLoader } from "@/components/SelfImprovementLoader";
import { MitraPact } from "@/components/MitraPact";
import { VitalityPanel } from "@/components/VitalityPanel";
import { CheckinBanner } from "@/components/CheckinBanner";
import { IntentPill } from "@/components/IntentPill";
import {
  evaluateMatchQuality,
  mapAgentRestaurantsToScored,
  normalizeStrictDietary,
  normalizeWellnessTags,
  resolveAgenticOutcomes,
  scoreRestaurants,
  type DialState,
  type Promo,
  type Restaurant,
  type ScoredRestaurant,
} from "@/lib/veda";
import { loadTwin, getBloodSugarLens, setBloodSugarLens } from "@/lib/memory";
import { loadIntent, clearIntent, type ParsedIntent } from "@/lib/intent";
import { estimateGlycemic, type GLEstimate } from "@/lib/glycemic";
import { LEARNING_MESSAGES, pickLearningMessage, runSelfImprovementRoutine } from "@/lib/selfImprovement";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Info, Droplet } from "lucide-react";

async function fetchParsedRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.from("restaurants").select("*");
  if (error) throw error;
  return (data ?? []).filter(
    (r) => Array.isArray(r.menu_items) && (r.menu_items as unknown[]).length > 0,
  );
}

const Index = () => {
  const navigate = useNavigate();
  const [intent, setIntent] = useState<ParsedIntent | null>(null);
  const [scoredPool, setScoredPool] = useState<ScoredRestaurant[]>([]);
  const [dataSource, setDataSource] = useState<"database" | "synthesized" | "agentic">("database");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);
  const [learningMessage, setLearningMessage] = useState(LEARNING_MESSAGES[0]);
  const [vitality, setVitality] = useState<number | null>(loadTwin().last_vitality_score ?? null);
  const [heroIdOverride, setHeroIdOverride] = useState<string | null>(null);
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [dials, setDials] = useState<DialState>({
    energy: 50,
    context: 40,
    budget: 50,
    purity: 70,
  });
  const [lens, setLens] = useState<boolean>(getBloodSugarLens());
  const [glMap, setGlMap] = useState<Record<string, GLEstimate>>({});
  const animatedFromIntentRef = useRef(false);
  const selfImprovementRanRef = useRef(false);
  const learningStartedRef = useRef<number | null>(null);

  const twin = useMemo(
    () => ({ ...loadTwin(), last_vitality_score: vitality ?? undefined }),
    [vitality],
  );

  const scoreFromDb = useCallback(
    (restaurants: Restaurant[], promoList: Promo[], parsed: ParsedIntent) =>
      scoreRestaurants(
        restaurants,
        parsed.dials,
        promoList,
        twin,
        parsed.filters.dish,
        parsed.filters.cuisine,
        normalizeWellnessTags(parsed.filters.wellness_tags),
        normalizeStrictDietary(parsed.filters.dietary),
      ),
    [twin],
  );

  // On mount: load intent, redirect to / if none, then animate dials to parsed values.
  useEffect(() => {
    const i = loadIntent();
    if (!i) {
      navigate("/", { replace: true });
      return;
    }
    setIntent(i);
    setDials(i.dials);
    document.title = "Rasaoi — Veda's Reading";
    if (i.lens === "blood_sugar" && !getBloodSugarLens()) {
      setBloodSugarLens(true);
      setLens(true);
    }
    if (animatedFromIntentRef.current) return;
    animatedFromIntentRef.current = true;
    const start = { energy: 50, context: 40, budget: 50, purity: 70 };
    const target = i.dials;
    const duration = 600;
    const t0 = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = ease(p);
      setDials({
        energy: Math.round(start.energy + (target.energy - start.energy) * e),
        context: Math.round(start.context + (target.context - start.context) * e),
        budget: Math.round(start.budget + (target.budget - start.budget) * e),
        purity: Math.round(start.purity + (target.purity - start.purity) * e),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [navigate]);

  // ARCH-002: DB query → quality gate → optional synthesis → re-fetch
  useEffect(() => {
    if (!intent) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const pRes = await supabase.from("active_promos").select("*");
        const promoList = pRes.data ?? [];
        if (!cancelled) setPromos(promoList);

        let restaurants = await fetchParsedRestaurants();
        let scored = scoreFromDb(restaurants, promoList, intent);
        let quality = evaluateMatchQuality(scored, {
          cuisine: intent.filters.cuisine,
          dish: intent.filters.dish,
          dietary: normalizeStrictDietary(intent.filters.dietary),
          wellness_tags: normalizeWellnessTags(intent.filters.wellness_tags),
          transcript: intent.transcript,
        });

        if (quality.needsImprovement && !selfImprovementRanRef.current) {
          selfImprovementRanRef.current = true;
          setLearning(true);
          learningStartedRef.current = Date.now();
          try {
            await runSelfImprovementRoutine(intent);
            restaurants = await fetchParsedRestaurants();
            scored = scoreFromDb(restaurants, promoList, intent);
            quality = evaluateMatchQuality(scored, {
              cuisine: intent.filters.cuisine,
              dish: intent.filters.dish,
              dietary: normalizeStrictDietary(intent.filters.dietary),
            });
            if (!cancelled) {
              setScoredPool(scored);
              setDataSource("synthesized");
            }
          } catch (e) {
            console.warn("Self-improvement routine skipped:", e);
            const agentic = resolveAgenticOutcomes(
              intent.scored_restaurants?.length
                ? intent.scored_restaurants
                : mapAgentRestaurantsToScored(intent.restaurants ?? [], promoList),
            );
            if (!cancelled) {
              setScoredPool(agentic);
              setDataSource("agentic");
            }
          } finally {
            if (!cancelled) setLearning(false);
          }
        } else if (!cancelled) {
          setScoredPool(scored);
          setDataSource("database");
        }
      } catch (e) {
        console.error("Reading page load failed:", e);
        if (!cancelled && intent.scored_restaurants?.length) {
          setScoredPool(resolveAgenticOutcomes(intent.scored_restaurants));
          setDataSource("agentic");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intent, scoreFromDb]);

  useEffect(() => {
    if (!learning) return;
    const id = window.setInterval(() => {
      const started = learningStartedRef.current ?? Date.now();
      setLearningMessage(pickLearningMessage(Date.now() - started));
    }, 800);
    return () => window.clearInterval(id);
  }, [learning]);

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    scoredPool.forEach((s) => s.restaurant.cuisine && set.add(s.restaurant.cuisine));
    return Array.from(set).sort();
  }, [scoredPool]);

  const intentCuisine = useMemo(() => {
    if (!intent?.filters?.cuisine || cuisineOptions.length === 0) return null;
    const wanted = intent.filters.cuisine.toLowerCase();
    return cuisineOptions.find((c) => c.toLowerCase().includes(wanted) || wanted.includes(c.toLowerCase())) ?? null;
  }, [intent, cuisineOptions]);

  const dishMatchCount = useMemo(() => {
    const wanted = intent?.filters?.dish?.toLowerCase().trim();
    if (!wanted || scoredPool.length === 0) return null;
    const tokens = wanted.split(/\s+/).filter((t) => t.length >= 3);
    if (!tokens.length) return null;
    let n = 0;
    for (const { restaurant: r } of scoredPool) {
      const menu = Array.isArray(r.menu_items) ? (r.menu_items as { name?: string; description?: string }[]) : [];
      const hit =
        menu.some((m) => {
          const blob = ((m?.name ?? "") + " " + (m?.description ?? "")).toLowerCase();
          return tokens.some((t) => blob.includes(t));
        }) || tokens.some((t) => (r.signature_dish ?? "").toLowerCase().includes(t));
      if (hit) n++;
    }
    return n;
  }, [intent, scoredPool]);

  const glOrder: Record<string, number> = { low: 0, med: 1, high: 2 };

  const scored = useMemo(() => {
    const all = resolveAgenticOutcomes(scoredPool);
    const filtered = cuisineFilter
      ? all.filter((s) => s.restaurant.cuisine === cuisineFilter)
      : all;
    const needsSort = (!cuisineFilter && intentCuisine) || lens;
    if (!needsSort) return filtered;
    return [...filtered].sort((a, b) => {
      if (lens) {
        const aGL = glMap[a.restaurant.signature_dish?.toLowerCase() ?? ""]?.glycemic_load;
        const bGL = glMap[b.restaurant.signature_dish?.toLowerCase() ?? ""]?.glycemic_load;
        const aR = aGL ? glOrder[aGL] : 1;
        const bR = bGL ? glOrder[bGL] : 1;
        if (aR !== bR) return aR - bR;
      }
      if (!cuisineFilter && intentCuisine) {
        const aMatch = a.restaurant.cuisine === intentCuisine ? 1 : 0;
        const bMatch = b.restaurant.cuisine === intentCuisine ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      return b.score - a.score;
    });
  }, [scoredPool, cuisineFilter, intentCuisine, lens, glMap]);

  useEffect(() => {
    if (!lens) return;
    const dishes = scored
      .slice(0, 8)
      .map((s) => s.restaurant)
      .filter((r) => r.signature_dish)
      .map((r) => ({ name: r.signature_dish!, cuisine: r.cuisine }));
    if (!dishes.length) return;
    estimateGlycemic(dishes).then((batch) => {
      const keyed: Record<string, GLEstimate> = {};
      for (const d of dishes) {
        const k = (d.name + "|").toLowerCase().trim();
        const v = batch[k];
        if (v) keyed[d.name.toLowerCase()] = v;
      }
      setGlMap((prev) => ({ ...prev, ...keyed }));
    });
  }, [lens, scored]);

  useEffect(() => {
    setHeroIdOverride(null);
  }, [dials, vitality, cuisineFilter]);

  let hero: ScoredRestaurant | null = null;
  let alternates: ScoredRestaurant[] = [];

  if (scored.length > 0) {
    if (heroIdOverride) {
      const found = scored.find((s) => s.restaurant.id === heroIdOverride);
      if (found) {
        hero = found;
        alternates = scored.filter((s) => s.restaurant.id !== heroIdOverride);
      }
    }
    if (!hero) {
      hero = scored[0];
      alternates = scored.slice(1, 7);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MitraPact />

      <header className="border-b border-gold/40 bg-primary sticky top-0 z-10 shadow-sm">
        <div className="container max-w-6xl flex items-center justify-between py-3 sm:py-5">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="serif text-2xl sm:text-3xl text-gold tracking-tight font-semibold">Rasaoi</h1>
              <span className="hidden md:inline text-[11px] uppercase tracking-[0.2em] text-card/70">
                El Dorado Hills · Folsom
              </span>
            </div>
            <span className="hidden sm:inline serif italic text-xs sm:text-sm text-gold/85 mt-0.5">
              Care in every choice. Trust in every meal.
            </span>
          </div>

          <Popover>
            <PopoverTrigger
              aria-label="The Mitra Pact"
              className="text-card/70 hover:text-gold transition-elegant p-2 rounded-sm"
            >
              <Info className="w-4 h-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-sm border-gold/40 text-sm">
              <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold mb-1">
                Mitra's Note
              </div>
              <p className="text-foreground/85 leading-relaxed">
                Rasaoi is lifestyle wellness — not medical advice. Verify allergies with the kitchen.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="container max-w-6xl py-6 sm:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            onClick={() => clearIntent()}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-gold transition-elegant"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Ask again
          </Link>
          <span className="text-[10px] uppercase tracking-[0.25em] text-gold/80 font-semibold">
            Veda's Reading
          </span>
        </div>

        {intent && <IntentPill intent={intent} />}

        {dataSource === "synthesized" && !learning && (
          <div className="rounded-sm border border-emerald-300/60 bg-emerald-50/80 px-4 py-3 text-sm">
            <span className="text-[10px] uppercase tracking-[0.22em] text-emerald-800 font-semibold">
              Self-improving database
            </span>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Veda expanded the venue cache for your constraints — these matches are now persisted for future diners.
            </p>
          </div>
        )}

        {dataSource === "agentic" && !learning && (
          <div className="rounded-sm border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
            <span className="text-[10px] uppercase tracking-[0.22em] text-gold font-semibold">Agentic fallback</span>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Live synthesis unavailable — showing generated recommendations without database persistence.
            </p>
          </div>
        )}

        {!loading && !learning && intent?.filters?.dish && dishMatchCount === 0 && (
          <div className="rounded-sm border border-border/70 bg-card px-4 py-3 text-sm">
            <span className="text-foreground/80">
              No <span className="serif italic text-primary">"{intent.filters.dish}"</span> found in parsed menus nearby.
            </span>{" "}
            <span className="text-muted-foreground">Showing best-aligned alternatives — try widening below.</span>
          </div>
        )}

        <section className="space-y-6">
          {learning ? (
            <SelfImprovementLoader message={learningMessage} />
          ) : loading ? (
            <p className="text-center text-muted-foreground py-12">Calibrating reasoning engine…</p>
          ) : hero ? (
            <>
              <HeroCard
                item={hero}
                dials={dials}
                vitality={vitality}
                intent={intent?.filters}
                gl={lens ? glMap[hero.restaurant.signature_dish?.toLowerCase() ?? ""] : undefined}
              />

              {alternates.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
                        Other Outcomes
                      </span>
                      {intentCuisine && !cuisineFilter && (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-sm font-semibold">
                          Showing {intentCuisine} first
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground italic">
                      Tap to make it your hero
                    </span>
                  </div>
                  <div className="relative">
                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
                      {alternates.map((alt, i) => (
                        <MiniCard
                          key={alt.restaurant.id}
                          item={alt}
                          rank={i + 1}
                          dials={dials}
                          intent={intent?.filters}
                          gl={lens ? glMap[alt.restaurant.signature_dish?.toLowerCase() ?? ""] : undefined}
                          onPromote={() => setHeroIdOverride(alt.restaurant.id)}
                        />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-background to-transparent" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">No outcomes yet — adjust the dials in Refine below.</p>
          )}
        </section>

        <details className="group rounded-sm border border-border/60 bg-card/50" open>
          <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 select-none">
            <span className="text-[11px] uppercase tracking-[0.25em] text-primary font-semibold">
              Refine this reading
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground group-open:hidden">
              Tap to open
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground hidden group-open:inline">
              Collapse
            </span>
          </summary>

          <div className="px-4 pb-5 pt-2 space-y-6 border-t border-border/40">
            <section className="grid sm:grid-cols-2 gap-4">
              <Dial label="Energy" leftLabel="Exhausted" rightLabel="Peak"
                value={dials.energy} onChange={(v) => setDials({ ...dials, energy: v })}
                hint="Your current physical reserve."
                badge={vitality !== null ? "Vitality Sync Active" : undefined} />
              <Dial label="Context" leftLabel="Solo / Fast" rightLabel="Social / Celebratory"
                value={dials.context} onChange={(v) => setDials({ ...dials, context: v })}
                hint="Who you are eating with, and why." />
              <Dial label="Budget" leftLabel="Target $25" rightLabel="Unlimited"
                value={dials.budget} onChange={(v) => setDials({ ...dials, budget: v })}
                hint="The ceiling, not the target." />
              <Dial label="Purity" leftLabel="Standard" rightLabel="Good for you"
                value={dials.purity} onChange={(v) => setDials({ ...dials, purity: v })}
                hint="Standard · Natural · Good for you — ghee, cold-pressed, seed-oil-free." />
            </section>

            <CuisineFilter
              value={cuisineFilter}
              options={cuisineOptions}
              onChange={setCuisineFilter}
            />

            <div className="flex items-center justify-between gap-3 flex-wrap rounded-sm border border-border/60 bg-card px-4 py-3">
              <div className="flex items-start gap-2 text-sm">
                <Droplet className={`w-4 h-4 mt-0.5 shrink-0 ${lens ? "fill-emerald-600 text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-primary font-semibold">
                    Blood-sugar-friendly lens
                  </div>
                  {lens ? (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">
                      Showing low-glycemic options first. Estimates only — talk to your doctor about your targets.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">
                      Re-ranks results by estimated glycemic load and suggests carrier swaps.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { const n = !lens; setLens(n); setBloodSugarLens(n); }}
                aria-pressed={lens}
                className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-sm border transition-elegant ${
                  lens
                    ? "bg-emerald-50 text-emerald-900 border-emerald-400 font-semibold"
                    : "bg-card text-muted-foreground border-border/70 hover:border-emerald-300 hover:text-emerald-800"
                }`}
              >
                {lens ? "On" : "Turn on"}
              </button>
            </div>

            <VitalityPanel onChange={setVitality} />
          </div>
        </details>

        <CheckinBanner />

        <footer className="text-center space-y-2 py-8 border-t border-border/40">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Rasaoi · A System of Outcome · Basis Advise LLC
          </p>
          <p className="text-[10px] text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
            Lifestyle wellness — not medical advice. Verify allergies with the kitchen.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
