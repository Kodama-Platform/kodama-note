import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(pkgRoot, "dist"), { recursive: true });
copyFileSync(join(pkgRoot, "src/styles.css"), join(pkgRoot, "dist/styles.css"));
