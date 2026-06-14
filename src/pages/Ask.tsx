import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { MitraPact } from "@/components/MitraPact";
import { MicCapture } from "@/components/MicCapture";
import { parseIntent, RateLimitError, getGeminiCooldownRemainingMs } from "@/lib/intent";
import { setBloodSugarLens } from "@/lib/memory";
import { toast } from "@/hooks/use-toast";

const EXAMPLES = [
  "I'm low energy, $35, something healthy",
  "Date night, splurge, somewhere celebratory",
  "Quick lunch alone, clean and nearby",
  "Diabetic-friendly, low sugar, under $30",
];

const Ask = () => {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    document.title = "Rasaoi — Ask Veda";
  }, []);

  useEffect(() => {
    const tick = () => {
      const ms = getGeminiCooldownRemainingMs();
      setCooldownSec(ms > 0 ? Math.ceil(ms / 1000) : 0);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy || cooldownSec > 0) return;
    setBusy(true);
    try {
      const parsed = await parseIntent(t);
      if (parsed.lens === "blood_sugar") {
        setBloodSugarLens(true);
      }
      navigate("/reading");
    } catch (e) {
      const isRateLimit = e instanceof RateLimitError;
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({
        variant: "destructive",
        title: isRateLimit ? "Free-tier rate limit" : "Veda couldn't hear you",
        description: msg,
      });
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MitraPact />

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-xl space-y-10 text-center">
          <header className="space-y-2">
            <h1 className="serif text-5xl sm:text-6xl text-primary tracking-tight">Rasaoi</h1>
            <p className="text-[11px] uppercase tracking-[0.3em] text-gold font-semibold">
              The System of Outcome
            </p>
            <p className="serif italic text-base text-muted-foreground pt-1">
              Tell Veda how you feel. She'll design the meal.
            </p>
          </header>

          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <MicCapture value={text} onChange={setText} disabled={busy} />
              <div className="flex-1 text-left">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy}
                  rows={3}
                  placeholder="I'm low energy, $35, something healthy…"
                  className="w-full resize-none rounded-sm border border-border bg-card px-4 py-3 text-base focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/40 disabled:opacity-60"
                  aria-label="Tell Veda what you need"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={submit}
                disabled={!text.trim() || busy || cooldownSec > 0}
                className="inline-flex items-center gap-2 bg-primary text-card border border-gold/40 px-6 py-3 rounded-sm text-[11px] uppercase tracking-[0.25em] font-semibold hover:bg-gold hover:text-primary transition-elegant disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Veda is listening
                  </>
                ) : cooldownSec > 0 ? (
                  <>Wait {cooldownSec}s (free tier)</>
                ) : (
                  <>
                    Ask Veda <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {cooldownSec > 0 && (
              <p className="text-[11px] text-muted-foreground italic text-center">
                Gemini free tier — one request every ~45s. Repeating the same question uses cache (no API call).
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Or try
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  disabled={busy}
                  className="text-[12px] italic text-muted-foreground border border-border/70 px-3 py-1.5 rounded-sm hover:border-gold/50 hover:text-primary transition-elegant disabled:opacity-40"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center px-5 py-6 border-t border-border/40 space-y-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Rasaoi · Basis Advise LLC
        </p>
        <p className="text-[10px] text-muted-foreground/80">
          Lifestyle wellness — not medical advice.
        </p>
      </footer>
    </div>
  );
};

export default Ask;
