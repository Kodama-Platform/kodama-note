import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const editorSrc = path.resolve(root, "../../packages/kodama-editor/src");

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@kodama\.page\/editor$/,
        replacement: path.resolve(editorSrc, "index.ts"),
      },
      {
        find: /^@kodama\.page\/editor\/styles\.css$/,
        replacement: path.resolve(editorSrc, "styles.css"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    open: false,
    fs: {
      allow: [path.resolve(root, "../..")],
    },
  },
});