import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) sets up its Node "fake worker" with a dynamic
  // `import()` of a relative path it computes at runtime. Turbopack cannot
  // statically resolve that path and bakes in a wrong chunk location, which
  // makes PDF extraction fail every time under `next dev`/`next build`
  // ("Setting up fake worker failed: Cannot find module '.../chunks/pdf.worker.mjs'").
  // Excluding these packages from bundling lets Node's normal module
  // resolution load them unmodified, so the relative import resolves
  // against their real on-disk location instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
