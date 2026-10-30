import { describe, expect, it } from "vitest";
import { createApplication } from "@/application";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { createAuth } from "./auth";

const baseURL = "http://localhost:3000";

async function authWith(testSignIn: boolean) {
  const db = await createTestDatabase();
  const application = createApplication({
    db,
    clock: { now: () => new Date("2026-11-02T15:00:00Z") },
    ownerEmail: seedPeople.owner.email,
  });
  const auth = createAuth({
    db,
    application,
    secret: "test-secret-that-is-at-least-32-characters-long",
    baseURL,
    google: { clientId: "test", clientSecret: "test" },
    testSignIn,
  });
  return { auth, application };
}

const signInAs = (email: string, method = "POST") =>
  new Request(`${baseURL}/api/auth/test/sign-in`, {
    method,
    headers: { "content-type": "application/json", origin: baseURL },
    body: method === "GET" ? undefined : JSON.stringify({ email }),
  });

describe("test-only sign-in", () => {
  it("does not exist without the test flag", async () => {
    const { auth } = await authWith(false);

    const response = await auth.handler(signInAs(seedPeople.owner.email));

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("signs in a seeded person and sends them to the main view when the flag is set", async () => {
    const { auth } = await authWith(true);

    const response = await auth.handler(signInAs(seedPeople.viewer.email));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookie.split(";")[0] }),
    });
    expect(session?.user.email).toBe(seedPeople.viewer.email);
  });

  it("does not sign anyone in from a GET, so a link on another site can't", async () => {
    const { auth } = await authWith(true);

    const response = await auth.handler(signInAs(seedPeople.viewer.email, "GET"));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
