import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HeartPulse, Lock } from "lucide-react";

interface Props {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export const BioConsentModal = ({ open, onConsent, onDecline }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDecline()}>
      <DialogContent className="max-w-lg rounded-sm border-gold/40">
        <DialogHeader>
          <div className="flex items-center gap-2 text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">
            <HeartPulse className="w-3.5 h-3.5" /> Biological Data Privacy
          </div>
          <DialogTitle className="serif text-3xl text-primary leading-tight">
            Consent to activate your Vitality Twin.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80 pt-2">
            To provide recovery-based recommendations, Rasaoi requests access to your
            sleep and HRV data. This data is processed locally with{" "}
            <strong className="text-primary">zero-knowledge handling</strong> and is{" "}
            <strong className="text-primary">never sold</strong>. By continuing, you agree
            to our Biological Data Privacy terms.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 p-4 bg-secondary rounded-sm border border-border/60 text-xs text-muted-foreground">
          <Lock className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p><strong className="text-primary">Local-first.</strong> Biometric data is held on this device.</p>
            <p><strong className="text-primary">Revocable.</strong> Withdraw consent anytime to clear all bio data.</p>
            <p><strong className="text-primary">CCPA / GDPR compliant.</strong></p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onDecline} className="rounded-sm">
            Not now
          </Button>
          <Button
            onClick={onConsent}
            className="bg-gradient-gold text-gold-foreground hover:opacity-90 rounded-sm font-semibold tracking-wide"
          >
            I Consent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
