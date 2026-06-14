import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface DialProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  badge?: string;
}

export const Dial = ({ label, leftLabel, rightLabel, value, onChange, hint, badge }: DialProps) => {
  return (
    <div className="space-y-4 p-6 rounded-sm bg-card border border-border/60 shadow-soft transition-elegant hover:shadow-elegant hover:border-gold/40">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="serif text-2xl text-primary">{label}</h3>
          {badge && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-primary bg-gold/20 px-2 py-0.5 rounded-sm border border-gold/40 font-semibold">
              <ShieldCheck className="w-2.5 h-2.5 text-gold" /> {badge}
            </span>
          )}
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-gold font-medium">
          {value}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground italic">{hint}</p>}
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center py-3"
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        max={100}
        step={1}
      >
        <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden bg-border">
          <SliderPrimitive.Range className="absolute h-full bg-gradient-gold" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block h-5 w-5 rounded-full border-2 border-gold bg-card shadow-gold",
            "transition-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          )}
        />
      </SliderPrimitive.Root>
      <div className="flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
};
