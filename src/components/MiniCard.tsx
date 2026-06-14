import type { ScoredRestaurant, DialState } from "@/lib/veda";
import { PurityIcon } from "./PurityIcon";
import { buildTripleOutcome, type IntentHint } from "@/lib/pairings";
import { TripleOutcome } from "./TripleOutcome";
import { ChevronRight, Droplet } from "lucide-react";
import { glColorClass, glLabel, type GLEstimate } from "@/lib/glycemic";

export const MiniCard = ({
  item,
  rank,
  dials,
  intent,
  gl,
  onPromote,
}: {
  item: ScoredRestaurant;
  rank: number;
  dials: DialState;
  intent?: IntentHint;
  gl?: GLEstimate;
  onPromote?: () => void;
}) => {
  const { restaurant: r, score } = item;
  const picks = buildTripleOutcome(r, dials, intent);

  return (
    <button
      onClick={onPromote}
      className="snap-start shrink-0 w-80 text-left group rounded-sm border border-border/60 bg-card hover:border-gold hover:shadow-soft transition-elegant overflow-hidden flex flex-col"
    >
      {/* Top strip — rank + match score */}
      <div className="bg-primary px-3 py-2 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.22em] text-card/80 font-semibold">
          #{rank + 1} Alternative
        </span>
        <span className="serif text-base text-gold font-semibold leading-none">
          {score}
          <span className="text-[10px] align-top ml-0.5">%</span>
        </span>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-2 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="truncate">{r.cuisine}</span>
          <PurityIcon tier={r.purity_tier} size={11} />
          {gl && (
            <span
              className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[9px] tracking-wider font-semibold ${glColorClass(gl.glycemic_load)}`}
              title={`${gl.carbs_g}g carbs · ${gl.why}`}
            >
              <Droplet className="w-2.5 h-2.5" /> {glLabel(gl.glycemic_load)}
            </span>
          )}
        </div>
        <div className="serif text-base text-primary leading-tight truncate group-hover:text-gold transition-elegant">
          {r.name}
        </div>

        <TripleOutcome picks={picks} size="sm" />

        {gl?.swap_suggestion && (gl.glycemic_load === "med" || gl.glycemic_load === "high") && (
          <p className="text-[10px] text-emerald-800 leading-snug">
            <span className="font-semibold uppercase tracking-wider">Swap:</span> {gl.swap_suggestion}
          </p>
        )}

        <div className="flex items-center justify-end pt-1">
          <ChevronRight className="w-3 h-3 text-gold opacity-0 group-hover:opacity-100 transition-elegant" />
        </div>
      </div>
    </button>
  );
};
