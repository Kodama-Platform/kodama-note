import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

import { devTlsOptions } from "./scripts/dev-tls.ts";

const tls = devTlsOptions();
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const kscRoot = path.resolve(repoRoot, "../kodama-security-core/packages");
const editorSrc = path.resolve(repoRoot, "packages/kodama-editor/src");
const useLocalKsc = fs.existsSync(path.join(kscRoot, "core/src/index.ts"));
// Keep Vite's optimize-deps cache off Dropbox — sync/locks cause empty deps + 504s.
const viteCacheDir = path.join(
  process.env.LOCALAPPDATA || process.env.TMPDIR || "/tmp",
  "kodama-note-vite",
);

// Pure SPA build — outputs static assets to dist/ for AWS Amplify.
export default defineConfig({
  cacheDir: viteCacheDir,
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@kodama.page/editor": path.join(editorSrc, "index.ts"),
      "@kodama.page/editor/styles.css": path.join(editorSrc, "styles.css"),
      ...(useLocalKsc
        ? {
            "@kodama.page/core": path.join(kscRoot, "core/src/index.ts"),
            "@kodama.page/security-browser": path.join(
              kscRoot,
              "security-browser/src/index.ts",
            ),
          }
        : {}),
    },
  },
  plugins: [
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
    include: ["@kodama.page/core", "@kodama.page/security-browser", "hash-wasm"],
    exclude: ["brotli-wasm"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "esnext",
  },
});
