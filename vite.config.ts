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
const appPkg = (name: string) => path.resolve(repoRoot, "node_modules", name);
const localKscAliases = useLocalKsc
  ? {
      "@kodama.page/core": path.join(kscRoot, "core/src/index.ts"),
      "@kodama.page/security-browser": path.join(
        kscRoot,
        "security-browser/src/index.ts",
      ),
      // Source lives outside this repo — resolve its deps from Note's node_modules.
      "brotli-wasm": appPkg("brotli-wasm"),
      "@noble/ed25519": appPkg("@noble/ed25519"),
      "@noble/hashes": appPkg("@noble/hashes"),
    }
  : {};
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
      ...localKscAliases,
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
    fs: {
      allow: [
        repoRoot,
        ...(useLocalKsc ? [path.resolve(repoRoot, "../kodama-security-core")] : []),
      ],
    },
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
    // Local KSC is aliased to source — do not prebundle it (bare @noble/*
    // imports then fail to resolve from the off-Dropbox deps cache).
    include: [
      "hash-wasm",
      "@noble/ed25519",
      "@noble/hashes",
      "@noble/hashes/sha512",
      ...(useLocalKsc ? [] : ["@kodama.page/core", "@kodama.page/security-browser"]),
    ],
    exclude: [
      "brotli-wasm",
      ...(useLocalKsc
        ? ["@kodama.page/core", "@kodama.page/security-browser"]
        : []),
    ],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "esnext",
  },
});
