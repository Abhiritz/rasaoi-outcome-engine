import { Loader2 } from "lucide-react";

interface SelfImprovementLoaderProps {
  message: string;
}

export const SelfImprovementLoader = ({ message }: SelfImprovementLoaderProps) => (
  <div
    className="rounded-sm border border-gold/40 bg-primary/5 px-6 py-10 text-center space-y-4"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" aria-hidden />
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-gold font-semibold mb-2">
        Veda is learning
      </p>
      <p className="serif text-lg text-primary">{message}</p>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
        Expanding our culinary database with constraint-aware venues tailored to your request.
      </p>
    </div>
  </div>
);
