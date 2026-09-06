/**
 * ROE-025 — Culinary facts cache facade for Reading / score-reading prep.
 *
 * Default mode: build-time static `culinary-index.json` (always available).
 * Optional overlay: experimental remote hydrate when
 * `VITE_EXPERIMENTAL_DYNAMIC_CULINARY=true` (staging sandbox — never auto-promotes).
 *
 * Production CDN / TTL table is deferred until a reviewed promote path exists.
 */

import {
  getCulinaryIndexMeta,
  getCulinaryLookupOverlay,
} from "./culinaryIndex";
import {
  hydrateCulinaryKnowledgeFromRemote,
  isCulinaryRemoteHydrated,
  remoteCulinaryStats,
} from "./experimental/culinaryRuntime";
import { isExperimentalDynamicCulinaryEnabled } from "./experimental/culinaryKnowledge";

export type CulinaryCacheMode = "static" | "remote_overlay";

export interface CulinaryCacheStatus {
  mode: CulinaryCacheMode;
  overlayInstalled: boolean;
  remoteHydrated: boolean;
  remoteRows: number;
  staticGeneratedAt: string;
  staticVersion: number;
}

/** Snapshot of which culinary fact source scoring will see. */
export function culinaryCacheStatus(): CulinaryCacheStatus {
  const meta = getCulinaryIndexMeta();
  const remoteHydrated = isCulinaryRemoteHydrated();
  const remote = remoteCulinaryStats();
  const overlayInstalled = getCulinaryLookupOverlay() != null;
  const mode: CulinaryCacheMode =
    isExperimentalDynamicCulinaryEnabled() && remoteHydrated && overlayInstalled
      ? "remote_overlay"
      : "static";
  return {
    mode,
    overlayInstalled,
    remoteHydrated,
    remoteRows: remote.rows,
    staticGeneratedAt: meta.generatedAt,
    staticVersion: meta.version,
  };
}

/**
 * Ensure culinary lookup is ready before venue scoring.
 * Always safe: failures leave static index in place.
 */
export async function ensureCulinaryFactsHydrated(): Promise<CulinaryCacheMode> {
  if (!isExperimentalDynamicCulinaryEnabled()) {
    return "static";
  }
  await hydrateCulinaryKnowledgeFromRemote();
  return culinaryCacheStatus().mode;
}
