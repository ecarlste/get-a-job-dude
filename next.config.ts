import type { NextConfig } from "next";
import { readTestMode } from "./src/lib/test-mode";

// Fails the build and `next start` on a Vercel deployment with the test flag set.
readTestMode(process.env);

const nextConfig: NextConfig = {};

export default nextConfig;
