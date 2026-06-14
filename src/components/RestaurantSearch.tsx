import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import type { Restaurant } from "@/lib/veda";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  restaurants: Restaurant[];
  pinnedId: string | null;
  onPin: (id: string | null) => void;
  onIngest?: (newRestaurants: Restaurant[]) => void;
}

export const RestaurantSearch = ({ restaurants, pinnedId, onPin, onIngest }: Props) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [remoteHits, setRemoteHits] = useState<Restaurant[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pinned = useMemo(
    () => restaurants.find((r) => r.id === pinnedId) ?? null,
    [restaurants, pinnedId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return restaurants
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, restaurants]);

  useEffect(() => {
    setRemoteHits([]);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const findOnMap = async () => {
    const name = query.trim();
    if (!name) return;
    setSearching(true);
    const { data, error } = await supabase.functions.invoke("places-search", {
      body: { name },
    });
    setSearching(false);
    if (error) {
      console.error("name lookup failed:", error);
      return;
    }
    const found = (data?.restaurants ?? []) as Restaurant[];
    setRemoteHits(found);
    if (found.length && onIngest) onIngest(found);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
          Search a restaurant
        </span>
        <span className="text-[10px] text-muted-foreground italic">
          Pick one — dials will design your order
        </span>
      </div>

      {pinned ? (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-gold/40 bg-gold-soft/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
              Locked to this kitchen
            </div>
            <div className="serif text-lg text-primary truncate">{pinned.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {pinned.cuisine}
            </div>
          </div>
          <button
            onClick={() => {
              onPin(null);
              setQuery("");
            }}
            className="text-[10px] uppercase tracking-[0.2em] text-primary border border-primary/30 px-3 py-1.5 rounded-sm hover:bg-primary hover:text-card transition-elegant flex items-center gap-1.5"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length === 0 && query.trim()) {
                e.preventDefault();
                findOnMap();
              }
            }}
            placeholder="Try South Fork Grille, TAJ Grill, Selland's…"
            className="w-full rounded-sm border border-border bg-card pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/40"
          />

          {open && (matches.length > 0 || remoteHits.length > 0) && (
            <div className="absolute z-20 mt-1 w-full rounded-sm border border-border bg-card shadow-elegant max-h-80 overflow-y-auto">
              {matches.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onPin(r.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary border-b border-border/40 last:border-b-0 transition-elegant"
                >
                  <div className="serif text-base text-primary truncate">{r.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.cuisine} · {"$".repeat(r.price_tier)}
                    {r.id.startsWith("live:") && (
                      <span className="ml-2 text-gold">live</span>
                    )}
                  </div>
                </button>
              ))}
              {remoteHits.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onPin(r.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary border-b border-border/40 last:border-b-0 transition-elegant"
                >
                  <div className="serif text-base text-primary truncate">{r.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.cuisine} · {"$".repeat(r.price_tier)}
                    <span className="ml-2 text-gold">found on map</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && query.trim() && matches.length === 0 && remoteHits.length === 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-sm border border-border bg-card px-4 py-3 text-sm">
              <div className="text-muted-foreground italic mb-2">
                No kitchen matches "{query}".
              </div>
              <button
                onClick={findOnMap}
                disabled={searching}
                className="text-[10px] uppercase tracking-[0.25em] text-gold border border-gold/40 px-3 py-2 rounded-sm hover:bg-gold/10 transition-elegant disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Scanning the map…
                  </>
                ) : (
                  <>Search the map for "{query}"</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
