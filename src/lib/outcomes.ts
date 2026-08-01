// Outcome capture — writes every fulfillment selection to Lovable Cloud
// and mirrors a pending check-in pointer in localStorage so we can prompt
// the user 90 minutes later (or on next app open).

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./device";
import { checkinToRating } from "./experimental/telemetryFeedback";
import type { DialState } from "./veda";

export type Path = "dine_in" | "pickup" | "delivery";
export type Carrier = "self" | "doordash" | "ubereats" | null;

export interface PendingCheckin {
  id: string;
  restaurantName: string;
  dish: string;
  path: Path;
  carrier: Carrier;
  ts: number; // epoch ms
}

const PENDING_KEY = "rasaoi.pending_checkin.v1";

export function getPending(): PendingCheckin | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCheckin;
  } catch {
    return null;
  }
}

export function clearPending() {
  localStorage.removeItem(PENDING_KEY);
}

function setPending(p: PendingCheckin) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

interface RecordArgs {
  restaurantId: string;
  restaurantName: string;
  dish: string;
  path: Path;
  carrier: Carrier;
  dials: DialState;
  vitalityScore: number | null;
  rank: number; // 1, 2, 3
}

export async function recordSelection(args: RecordArgs): Promise<string | null> {
  const device_id = getDeviceId();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("outcome_selections")
    .insert({
      id,
      device_id,
      restaurant_id: args.restaurantId,
      restaurant_name: args.restaurantName,
      dish: args.dish,
      path: args.path,
      carrier: args.carrier,
      dials_snapshot: args.dials as unknown as never,
      vitality_score: args.vitalityScore,
      chose_outcome_rank: args.rank,
    });

  if (error) {
    console.error("recordSelection error:", error);
    return null;
  }

  // ROE-016: mirror into experimental feedback table when present (staging closed-loop).
  void supabase
    .from("experimental_outcome_feedback" as never)
    .insert({
      id,
      device_id,
      restaurant_id: args.restaurantId,
      restaurant_name: args.restaurantName,
      dish: args.dish,
      path: args.path,
      carrier: args.carrier,
      dials: args.dials as unknown as never,
      vitality_score: args.vitalityScore,
      rank: args.rank,
    } as never)
    .then(({ error: mirrorErr }) => {
      if (mirrorErr) {
        // Table may not exist on prod — ignore quietly
        console.debug("experimental feedback mirror skipped:", mirrorErr.message);
      }
    });

  setPending({
    id,
    restaurantName: args.restaurantName,
    dish: args.dish,
    path: args.path,
    carrier: args.carrier,
    ts: Date.now(),
  });
  return id;
}

export async function submitCheckin(opts: {
  id: string;
  status: "happened" | "skipped" | "elsewhere";
  energy?: "lower" | "same" | "higher";
  digestion?: "heavy" | "clean" | "off";
  reorder?: boolean;
}) {
  const device_id = getDeviceId();
  const { error } = await supabase.rpc("record_outcome_checkin", {
    p_id: opts.id,
    p_device_id: device_id,
    p_status: opts.status,
    p_energy: opts.energy ?? null,
    p_digestion: opts.digestion ?? null,
    p_reorder: opts.reorder ?? null,
  });
  if (error) {
    console.error("submitCheckin error:", error);
    console.warn("[ROE-016 telemetry] record_outcome_checkin failed", {
      id: opts.id,
      status: opts.status,
      message: error.message,
    });
  }

  // ROE-016 EXP-T5: mirror check-in quality onto experimental feedback (staging closed-loop).
  const rating = checkinToRating({
    status: opts.status,
    energy: opts.energy,
    digestion: opts.digestion,
  });
  if (rating != null) {
    const notes = [
      opts.status,
      opts.energy ? `energy=${opts.energy}` : null,
      opts.digestion ? `digestion=${opts.digestion}` : null,
      opts.reorder != null ? `reorder=${opts.reorder}` : null,
    ]
      .filter(Boolean)
      .join("|");
    console.info("[ROE-016 telemetry] check-in → experimental_outcome_feedback", {
      id: opts.id,
      checkin_rating: rating,
      checkin_notes: notes,
    });
    void supabase
      .from("experimental_outcome_feedback" as never)
      .update({
        checkin_rating: rating,
        checkin_notes: notes,
      } as never)
      .eq("id" as never, opts.id)
      .then(({ error: mirrorErr }) => {
        if (mirrorErr) {
          console.warn("[ROE-016 telemetry] checkin mirror FAILED", {
            id: opts.id,
            rating,
            message: mirrorErr.message,
          });
        } else {
          console.info("[ROE-016 telemetry] checkin mirror OK", { id: opts.id, rating });
        }
      });
  } else {
    console.info("[ROE-016 telemetry] check-in skipped mirror (no rating)", {
      id: opts.id,
      status: opts.status,
    });
  }

  clearPending();
}
