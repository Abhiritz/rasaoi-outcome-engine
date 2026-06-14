import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}

// Web Speech API typings (avoid pulling full DOM lib)
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const MicCapture = ({ value, onChange, disabled }: Props) => {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef<string>("");

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
  }, []);

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || disabled) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = value ? value.trim() + " " : "";

    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      const next = (baseRef.current + finalText + interim).replace(/\s+/g, " ").trim();
      onChange(next);
      if (finalText) baseRef.current += finalText + " ";
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const toggle = () => (listening ? stop() : start());

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      title={supported ? (listening ? "Tap to stop" : "Tap to speak") : "Voice not supported in this browser — type instead"}
      className={cn(
        "relative flex items-center justify-center w-16 h-16 rounded-full border transition-elegant shrink-0",
        listening
          ? "bg-gold border-gold text-primary shadow-gold animate-pulse"
          : "bg-card border-gold/50 text-gold hover:bg-gold/10 hover:border-gold",
        (!supported || disabled) && "opacity-40 cursor-not-allowed",
      )}
    >
      {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      {listening && (
        <span className="absolute inset-0 rounded-full border-2 border-gold/40 animate-ping" />
      )}
    </button>
  );
};
