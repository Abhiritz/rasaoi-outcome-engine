import { beforeEach, describe, expect, it } from "vitest";
import {
  clearScoreTelemetry,
  listScoreTelemetry,
  recordScoreTelemetry,
} from "./scoreTelemetry";

describe("ROE-029 score telemetry ring", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearScoreTelemetry();
  });

  it("records and lists events", () => {
    recordScoreTelemetry("gl_soft", { g: 0.7, restaurant: "x" });
    const list = listScoreTelemetry();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("gl_soft");
    expect(list[0].detail?.g).toBe(0.7);
  });

  it("ROE-035: records intent LLM summary kinds", () => {
    recordScoreTelemetry("intent_invoke", { len: 12 });
    recordScoreTelemetry("intent_llm_summary", { attempts: 3, ok: false });
    const events = listScoreTelemetry();
    expect(events.some((e) => e.kind === "intent_invoke")).toBe(true);
    expect(events.some((e) => e.kind === "intent_llm_summary")).toBe(true);
  });
});
