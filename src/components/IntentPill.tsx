import { Sparkles } from "lucide-react";
import type { ParsedIntent } from "@/lib/intent";

interface Props {
  intent: ParsedIntent;
}

export const IntentPill = ({ intent }: Props) => {
  const lowConfidence = intent.confidence === "low";
  const chips: string[] = [];
  if (intent.filters?.dish) chips.push(intent.filters.dish);
  if (intent.filters?.cuisine) chips.push(intent.filters.cuisine);
  const wellness = intent.filters?.wellness_tags;
  if (Array.isArray(wellness)) {
    for (const w of wellness) {
      if (typeof w === "string" && w.trim()) chips.push(w.replace(/_/g, " "));
    }
  }
  if (intent.filters?.dietary) chips.push(String(intent.filters.dietary));

  return (
    <div className="space-y-2">
      <div className="inline-flex items-start gap-2.5 rounded-sm border border-gold/40 bg-gold-soft/40 px-4 py-3 max-w-full">
        <Sparkles className="w-4 h-4 text-gold mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold mb-0.5">
            Veda heard
          </div>
          <div className="serif text-lg text-primary leading-snug">
            {intent.restated_intent}
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.map((c) => (
                <span
                  key={c}
                  className="text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm border border-gold/35 bg-card/60 text-primary/90 font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {lowConfidence && (
        <p className="text-[11px] text-muted-foreground italic px-1">
          Veda wasn't fully sure — nudge any dial to refine.
        </p>
      )}
    </div>
  );
};
