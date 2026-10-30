import { toPerson } from "@/application";

// A seeded person as the application sees them once signed in with a verified Google email.
export const asPerson = (p: { id: string; name: string; email: string }) =>
  toPerson({ ...p, emailVerified: true });
