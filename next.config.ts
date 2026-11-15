import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single-container deploy: .next/standalone carries a minimal server.
  output: "standalone",

  // Node-only packages must not be bundled by Turbopack — native addons and
  // CJS libraries break under the bundler's ESM interop.
  serverExternalPackages: [
    "better-sqlite3",
    "@react-pdf/renderer",
    "nodemailer",
    "stripe",
    "node-cron",
    "archiver",
  ],

  // Fonts are loaded from disk at runtime by the PDF engine; make sure the
  // standalone build carries them.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
