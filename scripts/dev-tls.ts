import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const certDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".cert");

/** Self-signed cert for local HTTPS dev (secure context on LAN IPs). */
export function devTlsOptions(): { key: Buffer; cert: Buffer } | undefined {
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return undefined;
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}
