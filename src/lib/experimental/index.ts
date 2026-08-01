/**
 * ROE-016 (EXP-001) — Sandbox barrel. Production scoring must not import this
 * unless behind an explicit experimental flag.
 */

export * from "./culinaryKnowledge";
export * from "./culinaryRuntime";
export * from "./modelRouter";
export * from "./nutrition";
export * from "./nutritionQuarantine";
export * from "./glycemicLensAdapter";
export * from "./telemetryFeedback";
export { isDishOnRestaurantCatalog, normalizeDishKey } from "@/lib/catalogGuard";
