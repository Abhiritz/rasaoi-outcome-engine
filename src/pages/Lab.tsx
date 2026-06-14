import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import { PERSONA_PRESETS, scoreDishes, type ScoredDish, type Dish } from "@/lib/vedaDishes";
import type { Tables } from "@/integrations/supabase/types";

type Restaurant = Tables<"restaurants">;

const Lab = () => {
  useEffect(() => {
    document.title = "Rasaoi Lab — Veda v2 QA";
  }, []);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [persona, setPersona] = useState(PERSONA_PRESETS[0]);
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [includeNonFood, setIncludeNonFood] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ingest pane
  const [ingestRestaurant, setIngestRestaurant] = useState<string>("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestBusy, setIngestBusy] = useState(false);
  const [proposed, setProposed] = useState<Record<string, unknown>[]>([]);
  const [proposedRaw, setProposedRaw] = useState("");

  const refresh = async () => {
    setLoading(true);
    const [rRes, dRes] = await Promise.all([
      supabase.from("restaurants").select("*").eq("cuisine", "Indian").order("name"),
      supabase.from("dishes").select("*").order("name"),
    ]);
    if (rRes.data) setRestaurants(rRes.data);
    if (dRes.data) setDishes(dRes.data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredDishes = useMemo(() => {
    if (restaurantFilter === "all") return dishes;
    return dishes.filter((d) => d.restaurant_id === restaurantFilter);
  }, [dishes, restaurantFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => d.category && set.add(d.category));
    return Array.from(set).sort();
  }, [dishes]);

  const scored: ScoredDish[] = useMemo(
    () =>
      scoreDishes(
        filteredDishes,
        persona.dials,
        { history: [], preferred_cuisines: {}, last_vitality_score: persona.vitality },
        {
          includeNonFood,
          categoryFilter: categoryFilter === "all" ? undefined : categoryFilter,
        },
      ).slice(0, 8),
    [filteredDishes, persona, includeNonFood, categoryFilter],
  );

  const restMap = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r])),
    [restaurants],
  );

  const submitFeedback = async (dishId: string, thumbs: "up" | "down") => {
    const note = thumbs === "down" ? window.prompt("What was off? (optional)") ?? "" : "";
    const { error } = await supabase.from("dishes_feedback" as never).insert({
      dish_id: dishId,
      persona: persona.id,
      dials_snapshot: persona.dials as unknown as Record<string, unknown>,
      thumbs,
      note,
    } as never);
    if (error) toast({ variant: "destructive", title: "Couldn't save", description: error.message });
    else toast({ title: thumbs === "up" ? "Logged 👍" : "Logged 👎" });
  };

  const runIngest = async () => {
    if (!ingestRestaurant || !ingestUrl) {
      toast({ variant: "destructive", title: "Pick a restaurant and paste a menu URL" });
      return;
    }
    setIngestBusy(true);
    setProposed([]);
    setProposedRaw("");
    try {
      const rest = restMap.get(ingestRestaurant);
      const { data, error } = await supabase.functions.invoke("ingest-menu", {
        body: {
          restaurant_id: ingestRestaurant,
          restaurant_name: rest?.name ?? "Unknown",
          source_url: ingestUrl,
        },
      });
      if (error) throw error;
      const payload = data as { proposed?: Record<string, unknown>[]; raw_excerpt?: string; error?: string };
      if (payload.error) throw new Error(payload.error);
      setProposed(payload.proposed ?? []);
      setProposedRaw(payload.raw_excerpt ?? "");
      toast({ title: `Parsed ${payload.proposed?.length ?? 0} dishes` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Ingest failed", description: msg });
    } finally {
      setIngestBusy(false);
    }
  };

  const commitProposed = async () => {
    if (!proposed.length) return;
    setIngestBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("commit-dishes", {
        body: { restaurant_id: ingestRestaurant, source_url: ingestUrl, dishes: proposed },
      });
      if (error) throw error;
      toast({ title: `Committed ${(data as { inserted?: number }).inserted ?? 0} dishes` });
      setProposed([]);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Commit failed", description: msg });
    } finally {
      setIngestBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="space-y-2 border-b border-border pb-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold font-semibold">Internal · Veda v2 QA</p>
          <h1 className="serif text-4xl text-primary">Rasaoi Lab</h1>
          <p className="text-sm text-muted-foreground">
            Dish-level ranking, persona presets, ingest pipeline. {dishes.length} dishes across{" "}
            {restaurants.length} Indian restaurants.
          </p>
        </header>

        {/* Persona + filter */}
        <section className="space-y-4">
          <h2 className="serif text-2xl text-primary">Persona</h2>
          <div className="flex flex-wrap gap-2">
            {PERSONA_PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={p.id === persona.id ? "default" : "outline"}
                size="sm"
                onClick={() => setPersona(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Energy {persona.dials.energy} · Context {persona.dials.context} · Budget {persona.dials.budget} · Purity{" "}
            {persona.dials.purity} · Vitality {persona.vitality ?? "—"}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Restaurant</span>
              <select
                value={restaurantFilter}
                onChange={(e) => setRestaurantFilter(e.target.value)}
                className="text-sm bg-background border border-border rounded px-2 py-1"
              >
                <option value="all">All</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-sm bg-background border border-border rounded px-2 py-1"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeNonFood}
                onChange={(e) => setIncludeNonFood(e.target.checked)}
              />
              Include drinks & desserts
            </label>
          </div>
        </section>

        {/* Ranked dishes */}
        <section className="space-y-4">
          <h2 className="serif text-2xl text-primary">Top dishes</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : scored.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No dishes yet. Use the Ingest pane below to scrape a menu.
            </div>
          ) : (
            <div className="space-y-3">
              {scored.map((s, i) => {
                const rest = restMap.get(s.dish.restaurant_id);
                return (
                  <Card key={s.dish.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                          <h3 className="serif text-lg text-primary">{s.dish.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {rest?.name}
                          </Badge>
                          <Badge className="text-xs bg-gold text-primary">{s.score}</Badge>
                        </div>
                        {s.dish.description && (
                          <p className="text-sm text-muted-foreground mt-1">{s.dish.description}</p>
                        )}
                        <p className="text-sm mt-2">{s.why}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-xs">
                            {s.dish.purity_tier}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {s.dish.confidence}
                          </Badge>
                        </div>
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Score breakdown
                          </summary>
                          <ul className="text-xs font-mono mt-1 space-y-0.5">
                            {s.breakdown.map((b, idx) => (
                              <li key={idx}>
                                <span className={b.delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {b.delta >= 0 ? "+" : ""}
                                  {b.delta.toFixed(1)}
                                </span>{" "}
                                {b.label}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" onClick={() => submitFeedback(s.dish.id, "up")}>
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => submitFeedback(s.dish.id, "down")}>
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Ingest pane */}
        <section className="space-y-4 border-t border-border pt-8">
          <h2 className="serif text-2xl text-primary">Ingest menu</h2>
          <p className="text-xs text-muted-foreground">
            Scrapes via Firecrawl (if connected) or plain fetch, then parses with Gemini 2.5-pro. Review proposals
            before committing.
          </p>
          <div className="grid sm:grid-cols-[1fr,2fr,auto] gap-2">
            <select
              value={ingestRestaurant}
              onChange={(e) => setIngestRestaurant(e.target.value)}
              className="text-sm bg-background border border-border rounded px-2 py-2"
            >
              <option value="">Pick restaurant…</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Input
              value={ingestUrl}
              onChange={(e) => setIngestUrl(e.target.value)}
              placeholder="https://restaurant.com/menu"
            />
            <Button onClick={runIngest} disabled={ingestBusy}>
              {ingestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scrape & parse"}
            </Button>
          </div>

          {proposedRaw && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw scrape excerpt</summary>
              <pre className="bg-muted p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap">{proposedRaw}</pre>
            </details>
          )}

          {proposed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{proposed.length} proposed dishes</p>
                <Button onClick={commitProposed} disabled={ingestBusy} size="sm">
                  Commit all
                </Button>
              </div>
              <Textarea
                value={JSON.stringify(proposed, null, 2)}
                onChange={(e) => {
                  try {
                    setProposed(JSON.parse(e.target.value));
                  } catch {
                    // ignore; user is mid-edit
                  }
                }}
                className="font-mono text-xs h-96"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Lab;
