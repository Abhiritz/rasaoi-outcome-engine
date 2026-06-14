import type { VitalityTwin } from "./veda";

const KEY = "rasaoi.vitality_twin.v1";
const PACT_KEY = "rasaoi.mitra_pact.accepted";
const BIO_KEY = "rasaoi.bio_consent.accepted";
const LENS_KEY = "rasaoi.blood_sugar_lens.v1";

export function getBloodSugarLens(): boolean {
  return localStorage.getItem(LENS_KEY) === "true";
}
export function setBloodSugarLens(on: boolean) {
  if (on) localStorage.setItem(LENS_KEY, "true");
  else localStorage.removeItem(LENS_KEY);
}

const empty: VitalityTwin = { history: [], preferred_cuisines: {} };

export function loadTwin(): VitalityTwin {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = { ...empty, ...JSON.parse(raw) };
    // Hard gate: vitality score is null until biometric consent is granted
    if (!isBioConsentAccepted()) parsed.last_vitality_score = undefined;
    return parsed;
  } catch {
    return empty;
  }
}

export function saveTwin(twin: VitalityTwin) {
  localStorage.setItem(KEY, JSON.stringify(twin));
}

export function recordOutcome(restaurantId: string, cuisine: string, satisfaction = 4) {
  const twin = loadTwin();
  twin.history.unshift({ restaurantId, satisfaction, date: new Date().toISOString() });
  twin.history = twin.history.slice(0, 50);
  twin.preferred_cuisines[cuisine] = (twin.preferred_cuisines[cuisine] ?? 0) + 1;
  saveTwin(twin);
  return twin;
}

export function setVitalityScore(score: number) {
  if (!isBioConsentAccepted()) return loadTwin(); // Hard gate
  const twin = loadTwin();
  twin.last_vitality_score = score;
  saveTwin(twin);
  return twin;
}

export function isPactAccepted() {
  return localStorage.getItem(PACT_KEY) === "true";
}
export function acceptPact() {
  localStorage.setItem(PACT_KEY, "true");
}

export function isBioConsentAccepted() {
  return localStorage.getItem(BIO_KEY) === "true";
}
export function acceptBioConsent() {
  localStorage.setItem(BIO_KEY, "true");
}
export function revokeBioConsent() {
  localStorage.removeItem(BIO_KEY);
  const twin = loadTwin();
  delete twin.last_vitality_score;
  saveTwin(twin);
}
