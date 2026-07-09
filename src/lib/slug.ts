import { z } from "zod";

const RESERVED = new Set([
  "api",
  "_",
  "__root",
  "admin",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "auth",
  "login",
  "signup",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Page name is required")
  .max(64, "Page name must be 64 characters or fewer")
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "Only lowercase letters, numbers, and hyphens; must start with a letter or number",
  )
  .refine((s) => !RESERVED.has(s), "That name is reserved");

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
