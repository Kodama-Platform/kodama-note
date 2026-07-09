import { SITE } from "@/lib/brand";

/** Routes and sections that exist in this app. */
export const NOTE_NAV = [
  { label: "How it works", section: "threat-model" },
  { label: "Security", to: "/security" as const },
  { label: "FAQ", section: "faq" },
] as const;

/** Parent forest site — not hosted in this repo. */
export const FOREST_LINKS = [
  { label: "Kodama Forest", href: SITE.mainUrl },
  { label: "Privacy", href: `${SITE.mainUrl}/privacy` },
  { label: "Support", href: `${SITE.mainUrl}/support` },
] as const;

export function sectionHref(section: string) {
  return `/#${section}`;
}
