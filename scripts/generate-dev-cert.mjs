import { existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const certDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".cert");
const keyPath = join(certDir, "key.pem");
const certPath = join(certDir, "cert.pem");

if (existsSync(keyPath) && existsSync(certPath)) {
  process.exit(0);
}

mkdirSync(certDir, { recursive: true });

try {
  execSync(
    [
      "openssl req -x509 -newkey rsa:2048",
      `-keyout "${keyPath}"`,
      `-out "${certPath}"`,
      "-days 825 -nodes",
      '-subj "/CN=localhost"',
    ].join(" "),
    { stdio: "inherit" },
  );
  console.log("Dev TLS certificate created in .cert/");
} catch {
  console.warn(
    "Could not create a dev TLS certificate (is OpenSSL installed?).\n" +
      "Use http://localhost:8080 on this machine — plain http://192.168.x.x will not support encryption.",
  );
}
