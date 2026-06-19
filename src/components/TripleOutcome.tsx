import type { OutcomePick } from "@/lib/pairings";
import { DietBadge } from "./DietBadge";
import { Sparkles, Leaf, Flame, Check } from "lucide-react";

const ICONS = {
  "best-match": Sparkles,
  "clean-vital": Leaf,
  "heritage": Flame,
} as const;

export const TripleOutcome = ({
  picks,
  size = "md",
  selectedIdx,
  onSelect,
}: {
  picks: OutcomePick[];
  size?: "sm" | "md";
  selectedIdx?: number;
  onSelect?: (idx: number) => void;
}) => {
  const isHero = size === "md";
  const interactive = typeof onSelect === "function";

  return (
    <div className="border border-border/60 rounded-sm bg-secondary/30 p-3 sm:p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
          The Three Outcomes
        </div>
        {interactive && (
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground italic">
            Tap to choose
          </div>
        )}
      </div>

      {picks.map((p, i) => {
        const Icon = ICONS[p.key];
        const isSelected = interactive ? selectedIdx === i : i === 0;
        const Wrapper = interactive ? "button" : "div";
        return (
          <Wrapper
            key={p.key}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onSelect?.(i) : undefined}
            className={`block w-full text-left transition-elegant rounded-sm ${
              isSelected
                ? "border-l-2 border-gold pl-3 py-1.5 bg-gold-soft/30"
                : `border-l border-border/60 pl-3 py-1 ${interactive ? "hover:bg-secondary/60 hover:border-gold/60" : "opacity-95"}`
            }`}
          >
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-gold/90 mb-0.5">
              <Icon className="w-3 h-3" />
              <span className="truncate">{p.label}</span>
              {isSelected && interactive && (
                <span className="ml-auto inline-flex items-center gap-1 text-gold normal-case tracking-normal text-[10px] not-italic">
                  <Check className="w-3 h-3" /> Chosen
                </span>
              )}
            </div>
            <div
              className={`serif text-primary leading-tight ${
                isSelected
                  ? isHero ? "text-2xl sm:text-3xl font-medium" : "text-lg font-medium"
                  : isHero ? "text-base" : "text-sm"
              }`}
            >
              {p.dish}
            </div>
            {p.carrier && (
              <div className="flex items-baseline gap-1.5 mt-0.5 text-[11px] text-foreground/85">
                <span className="text-gold font-bold">+</span>
                <span className="serif italic text-primary/85">{p.carrier}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 not-italic">
                  Culturally paired
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <DietBadge diet_class={p.diet_class} dietary_modifiers={p.dietary_modifiers} />
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-gold-soft/60 text-primary border border-gold/30 font-semibold">
                {p.purityTag}
              </span>
              <span className={`${isHero ? "text-[11px]" : "text-[10px]"} text-foreground/70 italic leading-snug`}>
                {p.why}
              </span>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
};
