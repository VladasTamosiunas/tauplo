import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "pdf-lib", "@pdf-lib/fontkit"],
  poweredByHeader: false,
  // A self-contained server in .next/standalone, so the app runs with `node server.js` on any machine or in the Dockerfile.
  output: "standalone",
  // The certificate PDF reads this font from disk with a computed path, which Next's file tracing cannot see.
  // Without this line a hosted copy builds and starts fine and then fails the first time someone downloads a certificate.
  outputFileTracingIncludes: {
    "/sertifikatai/[id]": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
