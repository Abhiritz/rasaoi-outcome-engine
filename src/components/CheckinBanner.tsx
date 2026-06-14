import { useEffect, useState } from "react";
import { getPending, submitCheckin, clearPending, type PendingCheckin } from "@/lib/outcomes";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

// Shows on next app open if there is a pending check-in older than ~60 min.
const CHECKIN_DELAY_MS = 60 * 60 * 1000;

export const CheckinBanner = () => {
  const [pending, setPending] = useState<PendingCheckin | null>(null);
  const [stage, setStage] = useState<"prompt" | "outcome" | "done">("prompt");

  useEffect(() => {
    const p = getPending();
    if (p && Date.now() - p.ts > CHECKIN_DELAY_MS) setPending(p);
  }, []);

  if (!pending) return null;

  const dismiss = () => {
    clearPending();
    setPending(null);
  };

  const recordHappened = () => setStage("outcome");

  const recordSkipped = async (status: "skipped" | "elsewhere") => {
    await submitCheckin({ id: pending.id, status });
    setStage("done");
    setTimeout(dismiss, 800);
  };

  const recordOutcome = async (energy: "lower" | "same" | "higher", digestion: "clean" | "heavy" | "off") => {
    await submitCheckin({
      id: pending.id,
      status: "happened",
      energy,
      digestion,
      reorder: digestion === "clean" && energy !== "lower",
    });
    setStage("done");
    setTimeout(dismiss, 800);
  };

  return (
    <div className="rounded-sm border border-gold/50 bg-gold-soft/40 p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-gold font-semibold mb-2">
        <Sparkles className="w-3 h-3" /> Mitra check-in
      </div>

      {stage === "prompt" && (
        <>
          <p className="text-sm text-foreground/90 mb-3">
            Earlier you chose <strong>{pending.dish}</strong> at <em>{pending.restaurantName}</em>. Did it happen?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={recordHappened} className="rounded-sm bg-primary text-xs">Yes</Button>
            <Button size="sm" variant="outline" onClick={() => recordSkipped("elsewhere")} className="rounded-sm text-xs">Ate elsewhere</Button>
            <Button size="sm" variant="ghost" onClick={() => recordSkipped("skipped")} className="rounded-sm text-xs">Skipped</Button>
          </div>
        </>
      )}

      {stage === "outcome" && (
        <>
          <p className="text-sm text-foreground/90 mb-3">How do you feel? Two taps.</p>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16">Energy</span>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("lower", "clean")} className="rounded-sm text-xs">Lower</Button>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("same", "clean")} className="rounded-sm text-xs">Same</Button>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("higher", "clean")} className="rounded-sm text-xs">Higher</Button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16">Digestion</span>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("same", "clean")} className="rounded-sm text-xs">Clean</Button>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("same", "heavy")} className="rounded-sm text-xs">Heavy</Button>
              <Button size="sm" variant="outline" onClick={() => recordOutcome("same", "off")} className="rounded-sm text-xs">Off</Button>
            </div>
          </div>
        </>
      )}

      {stage === "done" && (
        <p className="text-sm text-foreground/85 italic">Logged. Your Vitality Twin remembers.</p>
      )}
    </div>
  );
};
