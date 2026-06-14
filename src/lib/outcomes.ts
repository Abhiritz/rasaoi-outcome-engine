// Outcome capture — writes every fulfillment selection to Lovable Cloud
// and mirrors a pending check-in pointer in localStorage so we can prompt
// the user 90 minutes later (or on next app open).

import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./device";
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
  if (error) console.error("submitCheckin error:", error);
  clearPending();
}
