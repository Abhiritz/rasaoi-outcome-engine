import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ExternalLink, MapPin, Phone, MessageSquare, Sparkles, Copy } from "lucide-react";
import type { ScoredRestaurant, DialState } from "@/lib/veda";
import { recordSelection, type Path, type Carrier } from "@/lib/outcomes";
import {
  buildDirectionsUrl,
  buildPhoneSearchUrl,
  buildSmsHref,
  buildTelHref,
  venueAddress,
  venuePhone,
} from "@/lib/fulfillment";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: ScoredRestaurant;
  dish: string;
  rank: number;
  dials: DialState;
  vitality: number | null;
}

type Step = "choose" | "dine_in" | "pickup" | "delivery";

export const FulfillmentSheet = ({
  open, onOpenChange, item, dish, rank, dials, vitality,
}: Props) => {
  const r = item.restaurant;
  const [step, setStep] = useState<Step>("choose");
  const address = venueAddress(r);
  const phone = venuePhone(r);

  const log = async (path: Path, carrier: Carrier) => {
    await recordSelection({
      restaurantId: r.id,
      restaurantName: r.name,
      dish,
      path,
      carrier,
      dials,
      vitalityScore: vitality,
      rank,
    });
  };

  const reset = () => {
    setStep("choose");
    onOpenChange(false);
  };

  const directionsUrl = buildDirectionsUrl(r.name, address);

  // ---- Pickup composer ----
  const defaultMessage = `Hi, I'd like to place a pickup order:

• ${dish}

Pickup in about 25 minutes, paying at counter. Thank you — sent via Rasaoi.`;
  const [pickupMsg, setPickupMsg] = useState(defaultMessage);

  const sendSms = () => {
    const href = buildSmsHref(phone, pickupMsg);
    if (!href) {
      toast("Number unavailable", {
        description: `No phone on file for ${r.name}. Copy the order and call via search.`,
      });
      return;
    }
    log("pickup", "self");
    window.location.href = href;
    toast("Pickup order ready", { description: `Message drafted for ${r.name}.` });
    reset();
  };

  const callRestaurant = () => {
    log("pickup", "self");
    const tel = buildTelHref(phone);
    if (tel) {
      window.location.href = tel;
    } else {
      navigator.clipboard?.writeText(pickupMsg);
      window.open(buildPhoneSearchUrl(r.name), "_blank");
      toast("Order copied", { description: "Find the restaurant's number and call to place this order." });
    }
    reset();
  };

  const copyOrder = async () => {
    await navigator.clipboard?.writeText(pickupMsg);
    toast("Order copied to clipboard");
  };

  // ---- Delivery handoff ----
  const handoffDelivery = (carrier: "doordash" | "ubereats", url: string | null) => {
    log("delivery", carrier);
    const tag = `${dish} at ${r.name}`;
    navigator.clipboard?.writeText(tag).catch(() => {});
    toast("Leaving Rasaoi — Restaurant / Platform terms now apply.", {
      description: `${dish} copied. Paste in ${carrier === "doordash" ? "DoorDash" : "Uber Eats"} search if needed.`,
    });
    setTimeout(() => {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      reset();
    }, 700);
  };

  // ---- Dine-in flow ----
  const goDineIn = () => {
    log("dine_in", null);
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
    toast("Bon appétit", { description: `We'll check in with you after the meal.` });
    reset();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-sm border-t-2 border-gold max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="serif text-2xl text-primary">{dish}</SheetTitle>
          <SheetDescription className="text-xs uppercase tracking-[0.18em]">
            {r.name} · {r.cuisine}
          </SheetDescription>
        </SheetHeader>

        {step === "choose" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">How would you like this?</p>
            <div className="grid grid-cols-3 gap-3">
              <PathBtn label="Dine In" sub="At the restaurant" onClick={() => setStep("dine_in")} />
              <PathBtn label="Pickup" sub="Call ahead, skip fees" onClick={() => setStep("pickup")} highlight />
              <PathBtn label="Delivery" sub="DoorDash · Uber Eats" onClick={() => setStep("delivery")} />
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center pt-2">
              Pickup keeps the kitchen's full margin and skips delivery markup.
            </p>
          </div>
        )}

        {step === "dine_in" && (
          <div className="mt-6 space-y-5">
            <div className="rounded-sm border border-gold/40 bg-gold-soft/30 p-4 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Show this at the table
              </div>
              <p className="serif text-xl text-primary">{dish}</p>
              <p className="text-xs text-foreground/80 italic">
                Selected via Rasaoi — the System of Outcome.
              </p>
            </div>
            {address && (
              <div className="text-xs text-muted-foreground flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gold" />
                <span>{address}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={goDineIn} className="flex-1 rounded-sm bg-primary">
                <MapPin className="w-3.5 h-3.5 mr-2" /> Open directions
              </Button>
              {phone && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const tel = buildTelHref(phone);
                    if (!tel) return;
                    log("dine_in", null);
                    window.location.href = tel;
                    reset();
                  }}
                  className="rounded-sm border-primary/30"
                >
                  <Phone className="w-3.5 h-3.5 mr-2" /> Reserve
                </Button>
              )}
            </div>
            <BackBtn onClick={() => setStep("choose")} />
          </div>
        )}

        {step === "pickup" && (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Edit the message, then send by SMS or call. The kitchen keeps 100% — no platform fees.
            </p>
            <Textarea
              value={pickupMsg}
              onChange={(e) => setPickupMsg(e.target.value)}
              rows={7}
              className="text-sm rounded-sm font-mono"
            />
            {!phone && (
              <p className="text-[11px] text-muted-foreground">
                Number unavailable for {r.name}. Use Call (search) or copy the order text.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={sendSms}
                disabled={!phone}
                className="rounded-sm bg-primary"
                title={!phone ? "Number unavailable" : undefined}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-2" /> Send SMS
              </Button>
              <Button onClick={callRestaurant} variant="outline" className="rounded-sm border-primary/30">
                <Phone className="w-3.5 h-3.5 mr-2" /> Call
              </Button>
            </div>
            <Button onClick={copyOrder} variant="ghost" size="sm" className="w-full text-xs">
              <Copy className="w-3 h-3 mr-1.5" /> Copy order text
            </Button>
            <BackBtn onClick={() => setStep("choose")} />
          </div>
        )}

        {step === "delivery" && (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              We'll copy <em>"{dish}"</em> to your clipboard and open the platform.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handoffDelivery("doordash", r.doordash_url)} className="rounded-sm bg-primary">
                DoorDash <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
              <Button onClick={() => handoffDelivery("ubereats", r.ubereats_url)} variant="outline" className="rounded-sm border-primary/30">
                Uber Eats <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
            <BackBtn onClick={() => setStep("choose")} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const PathBtn = ({ label, sub, onClick, highlight }: {
  label: string; sub: string; onClick: () => void; highlight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center text-center p-4 rounded-sm border transition-elegant ${
      highlight
        ? "border-gold bg-gold-soft/40 hover:bg-gold-soft/70"
        : "border-border hover:border-gold/60 hover:bg-secondary/40"
    }`}
  >
    <span className={`serif text-base font-semibold ${highlight ? "text-gold" : "text-primary"}`}>{label}</span>
    <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{sub}</span>
  </button>
);

const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-gold transition-elegant"
  >
    ← Back
  </button>
);
