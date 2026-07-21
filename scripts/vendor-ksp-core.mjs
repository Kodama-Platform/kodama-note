#!/usr/bin/env node
/**
 * Copy a built @kodama.page/ksp-core dist into supabase/functions/vendor for Deno edge deploy.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corePkg = resolve(root, "../kodama-security-protocol/packages/core");
const vendorDir = join(root, "supabase/functions/vendor/ksp-core");

console.log("Building @kodama.page/ksp-core...");
const build = spawnSync("npm", ["run", "build"], { cwd: corePkg, stdio: "inherit", shell: true });
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
cpSync(join(corePkg, "dist"), vendorDir, { recursive: true });
console.log(`Vendored ksp-core to ${vendorDir}`);
