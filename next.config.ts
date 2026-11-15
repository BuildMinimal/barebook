import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single-container deploy: .next/standalone carries a minimal server.
  output: "standalone",

  // Native / node-only packages must not be bundled by Turbopack.
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],

  // Fonts are loaded from disk at runtime by the PDF engine; make sure the
  // standalone build carries them.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
