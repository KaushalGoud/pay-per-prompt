import { config as loadDotenv } from "dotenv";
import path from "node:path";

// Workspaces keep a single repo-root .env (mirrors the scaffold-hbar layout).
// Load it explicitly so both `next dev` and `next build` see the same values,
// including NEXT_PUBLIC_ vars that get inlined into the client bundle.
loadDotenv({ path: path.resolve(import.meta.dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
