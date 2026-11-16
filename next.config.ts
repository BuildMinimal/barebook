import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single-container deploy: .next/standalone carries a minimal server.
  output: "standalone",

  // Production builds use webpack (see package.json): turbopack builds drop
  // route handlers from the runtime manifest, so PDFs, Stripe, backup and the
  // health endpoint 404 in the shipped image. External packages stay out of
  // the bundle — native addons and heavy CJS libraries.
  serverExternalPackages: [
    "better-sqlite3",
    "@react-pdf/renderer",
    "nodemailer",
    "stripe",
    "node-cron",
  ],

  // Fonts are loaded from disk at runtime by the PDF engine; make sure the
  // standalone build carries them.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
