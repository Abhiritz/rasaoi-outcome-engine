import { describe, expect, it } from "vitest";
import { culinaryCacheStatus, ensureCulinaryFactsHydrated } from "./culinaryCache";

describe("ROE-025 culinary cache facade", () => {
  it("reports static mode by default (no experimental overlay)", () => {
    const st = culinaryCacheStatus();
    expect(st.mode).toBe("static");
    expect(st.staticVersion).toBeGreaterThan(0);
    expect(st.staticGeneratedAt.length).toBeGreaterThan(4);
  });

  it("ensureCulinaryFactsHydrated resolves to static without experimental flag", async () => {
    await expect(ensureCulinaryFactsHydrated()).resolves.toBe("static");
  });
});
