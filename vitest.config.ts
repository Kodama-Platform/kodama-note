import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const kscRoot = path.resolve(repoRoot, "../kodama-security-core/packages");
const editorSrc = path.resolve(repoRoot, "packages/kodama-editor/src");
const useLocalKsc = fs.existsSync(path.join(kscRoot, "core/src/index.ts"));
const appPkg = (name: string) => path.resolve(repoRoot, "node_modules", name);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "./src"),
      "@kodama.page/editor": path.join(editorSrc, "index.ts"),
      "@kodama.page/editor/styles.css": path.join(editorSrc, "styles.css"),
      ...(useLocalKsc
        ? {
            "@kodama.page/core": path.join(kscRoot, "core/src/index.ts"),
            "@kodama.page/security-browser": path.join(
              kscRoot,
              "security-browser/src/index.ts",
            ),
            "brotli-wasm": appPkg("brotli-wasm"),
            "@noble/ed25519": appPkg("@noble/ed25519"),
            "@noble/hashes": appPkg("@noble/hashes"),
          }
        : {}),
    },
  },
});
