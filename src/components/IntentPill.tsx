import { Sparkles } from "lucide-react";
import type { ParsedIntent } from "@/lib/intent";

interface Props {
  intent: ParsedIntent;
}

export const IntentPill = ({ intent }: Props) => {
  const lowConfidence = intent.confidence === "low";
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
