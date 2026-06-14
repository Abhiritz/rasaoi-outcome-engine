import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { acceptPact, isPactAccepted } from "@/lib/memory";

export const MitraPact = () => {
  const [open, setOpen] = useState(!isPactAccepted());

  const accept = () => {
    acceptPact();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg rounded-sm border-gold/40">
        <DialogHeader>
          <div className="flex items-center gap-2 text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> The Mitra Pact
          </div>
          <DialogTitle className="serif text-3xl text-primary leading-tight">
            A pact of transparency, not prescription.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80 pt-2 space-y-3">
            <p>
              Rasaoi is a <strong className="text-primary">lifestyle wellness</strong> system — not medical
              advice, diagnosis, or treatment. Recommendations are reasoning, not prescription.
            </p>
            <p>
              <strong className="text-primary">Attribute Disclosure:</strong> always verify allergies and
              ingredient details directly with the kitchen.
            </p>
            <p>
              <strong className="text-primary">Privacy Sovereign:</strong> any biometric data is processed
              with zero-knowledge handling (CCPA / GDPR).
            </p>
            <p>
              <strong className="text-primary">Order Handoff:</strong> upon ordering, you leave Rasaoi —
              the restaurant and delivery platform's terms then apply.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={accept} className="bg-gradient-gold text-gold-foreground hover:opacity-90 rounded-sm w-full font-semibold tracking-wide">
            I Accept the Mitra Pact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
