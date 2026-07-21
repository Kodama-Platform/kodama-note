import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

import { devTlsOptions } from "./scripts/dev-tls";

const tls = devTlsOptions();
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const kspRoot = path.resolve(repoRoot, "../kodama-security-protocol/packages");

// Pure SPA build — outputs static assets to dist/ for AWS Amplify.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@kodama.page/ksp-core": path.join(kspRoot, "core/src/index.ts"),
      "@kodama.page/ksp-browser": path.join(kspRoot, "browser/src/index.ts"),
    },
  },  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    // HTTPS enables Web Crypto on LAN IPs (http://192.168.x.x is not a secure context).
    ...(tls ? { https: tls } : {}),
  },
  preview: {
    host: "::",
    port: 8080,
    strictPort: true,
    ...(tls ? { https: tls } : {}),
  },
  optimizeDeps: {
    include: ["@kodama.page/ksp-core", "hash-wasm"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
