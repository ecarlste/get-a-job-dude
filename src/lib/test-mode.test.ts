import { describe, expect, it } from "vitest";
import { readTestMode } from "./test-mode";

describe("test mode", () => {
  it("is off unless the flag is set", () => {
    expect(readTestMode({ E2E_NOW: "2026-11-02T15:00:00Z" })).toEqual({ enabled: false });
  });

  it("fixes the clock when the flag is set", () => {
    expect(readTestMode({ E2E_TEST_MODE: "1", E2E_NOW: "2026-11-02T15:00:00Z" })).toEqual({
      enabled: true,
      now: new Date("2026-11-02T15:00:00Z"),
    });
  });

  it("refuses to start a Vercel deployment with the flag set", () => {
    expect(() => readTestMode({ E2E_TEST_MODE: "1", VERCEL: "1" })).toThrow(/E2E_TEST_MODE/);
  });

  it("rejects a fixed clock that isn't a valid instant", () => {
    expect(() => readTestMode({ E2E_TEST_MODE: "1", E2E_NOW: "next tuesday" })).toThrow(/E2E_NOW/);
  });
});
