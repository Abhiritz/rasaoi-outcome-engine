import { Activity, HeartPulse, Lock, ShieldCheck } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useEffect, useState } from "react";
import {
  loadTwin,
  setVitalityScore,
  isBioConsentAccepted,
  acceptBioConsent,
  revokeBioConsent,
} from "@/lib/memory";
import { Switch } from "@/components/ui/switch";
import { BioConsentModal } from "@/components/BioConsentModal";
import { toast } from "sonner";

interface Props {
  onChange: (s: number | null) => void;
}

export const VitalityPanel = ({ onChange }: Props) => {
  const [consented, setConsented] = useState(isBioConsentAccepted());
  const [showModal, setShowModal] = useState(false);
  const [score, setScore] = useState<number>(() => loadTwin().last_vitality_score ?? 65);
  const [historyCount, setHistoryCount] = useState(loadTwin().history.length);

  useEffect(() => {
    if (consented) {
      setVitalityScore(score);
      onChange(score);
    } else {
      onChange(null);
    }
  }, [score, consented, onChange]);

  useEffect(() => {
    const t = setInterval(() => setHistoryCount(loadTwin().history.length), 2000);
    return () => clearInterval(t);
  }, []);

  const handleToggle = (next: boolean) => {
    if (next) {
      // Hard gate — show consent modal first
      setShowModal(true);
    } else {
      revokeBioConsent();
      setConsented(false);
      toast("Vitality Sync paused — biometric data cleared.");
    }
  };

  const handleConsent = () => {
    acceptBioConsent();
    setConsented(true);
    setShowModal(false);
    setVitalityScore(score);
    toast.success("Vitality Sync activated.");
  };

  const state = score < 40 ? "Low Recovery" : score < 70 ? "Moderate" : "Optimal";
  const stateColor = score < 40 ? "text-destructive" : score < 70 ? "text-gold" : "text-primary";

  return (
    <>
      <BioConsentModal
        open={showModal}
        onConsent={handleConsent}
        onDecline={() => setShowModal(false)}
      />

      <section className="rounded-sm border border-gold/30 bg-gradient-to-br from-card to-gold-soft/20 p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gold" />
            <h3 className="text-[11px] uppercase tracking-[0.25em] font-semibold text-primary">
              Vitality Twin
            </h3>
            {consented ? (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-primary bg-gold/20 px-2 py-0.5 rounded-sm border border-gold/40 font-semibold">
                <ShieldCheck className="w-3 h-3 text-gold" /> Sync Active
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground bg-secondary px-2 py-0.5 rounded-sm border border-border">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {historyCount} outcomes
            </span>
            <div className="flex items-center gap-2">
              <HeartPulse className="w-3.5 h-3.5 text-gold" />
              <Switch checked={consented} onCheckedChange={handleToggle} />
            </div>
          </div>
        </div>

        {consented ? (
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-end">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-muted-foreground italic">
                  Simulated HRV / Sleep · drives anti-inflammatory prioritization
                </p>
                <span className={`text-xs uppercase tracking-[0.2em] font-semibold ${stateColor}`}>
                  {state}
                </span>
              </div>
              <SliderPrimitive.Root
                className="relative flex w-full touch-none select-none items-center py-2"
                value={[score]}
                onValueChange={(v) => setScore(v[0])}
                max={100}
                step={1}
              >
                <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden bg-border">
                  <SliderPrimitive.Range className="absolute h-full bg-gradient-gold" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-gold bg-card shadow-gold" />
              </SliderPrimitive.Root>
            </div>
            <div className="text-right">
              <div className="serif text-5xl text-gold leading-none">{score}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Score</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic leading-relaxed">
            Activate Health Sync to unlock recovery-based reasoning. Your HRV and sleep
            data remain local with zero-knowledge handling.
          </div>
        )}
      </section>
    </>
  );
};
