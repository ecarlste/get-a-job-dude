import { describe, expect, it } from "vitest";
import { readTestMode } from "./test-mode";

const localDb = "postgres://postgres:postgres@localhost:5432/e2e";

describe("test mode", () => {
  it("is off unless the flag is set", () => {
    expect(readTestMode({ E2E_NOW: "2026-11-02T15:00:00Z" })).toEqual({ enabled: false });
  });

  it("fixes the clock when the flag is set", () => {
    expect(readTestMode({ E2E_TEST_MODE: "1", DATABASE_URL: localDb, E2E_NOW: "2026-11-02T15:00:00Z" })).toEqual({
      enabled: true,
      now: new Date("2026-11-02T15:00:00Z"),
    });
  });

  it("refuses to start a Vercel deployment with the flag set", () => {
    expect(() => readTestMode({ E2E_TEST_MODE: "1", DATABASE_URL: localDb, VERCEL: "1" })).toThrow(/E2E_TEST_MODE/);
  });

  it("refuses to start against a database that isn't on localhost", () => {
    for (const DATABASE_URL of [
      undefined,
      "postgres://u:p@ep-example.neon.tech/db",
      "not a url",
      // node-postgres connects to the query parameter's host, not the URL's.
      "postgres://u:p@localhost/db?host=ep-example.neon.tech",
      "postgres://u:p@localhost/db?sslmode=require&hostaddr=203.0.113.7",
    ]) {
      expect(() => readTestMode({ E2E_TEST_MODE: "1", DATABASE_URL })).toThrow(/localhost/);
    }
  });

  it("rejects a fixed clock that isn't a valid instant", () => {
    expect(() => readTestMode({ E2E_TEST_MODE: "1", DATABASE_URL: localDb, E2E_NOW: "next tuesday" })).toThrow(/E2E_NOW/);
  });
});
