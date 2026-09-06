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
});
