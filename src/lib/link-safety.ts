export type LinkRiskLevel = "safe" | "caution" | "blocked";

export type LinkRiskAssessment = {
  level: LinkRiskLevel;
  reasons: string[];
  displayUrl: string;
  href: string | null;
};

const BLOCKED_PROTOCOLS = new Set(["javascript", "data", "blob", "file", "vbscript"]);

export function assessLinkRisk(rawHref: string): LinkRiskAssessment {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return {
      level: "blocked",
      reasons: ["This link is empty."],
      displayUrl: trimmed,
      href: null,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      level: "blocked",
      reasons: ["This does not look like a valid web address."],
      displayUrl: trimmed,
      href: null,
    };
  }

  const protocol = url.protocol.replace(":", "").toLowerCase();
  const reasons: string[] = [];

  if (BLOCKED_PROTOCOLS.has(protocol)) {
    return {
      level: "blocked",
      reasons: [
        `The "${protocol}:" protocol can run code or access local data and is not allowed.`,
      ],
      displayUrl: url.href,
      href: null,
    };
  }

  if (!["http", "https", "mailto", "tel"].includes(protocol)) {
    reasons.push(`Uses an uncommon protocol ("${protocol}:").`);
  }

  if (protocol === "http") {
    reasons.push("This link uses unencrypted HTTP.");
  }

  if (url.username || url.password) {
    reasons.push("The URL embeds a username or password, which is often used in phishing links.");
  }

  if (url.href.includes("@") && !url.href.startsWith("mailto:")) {
    reasons.push('The URL contains "@", which can hide the real destination.');
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) {
    reasons.push("Points to a numeric IP address instead of a named site.");
  }

  if (/^xn--/i.test(url.hostname)) {
    reasons.push("Uses an internationalized domain name that may look like another site.");
  }

  const port = url.port;
  const isStandardPort =
    !port ||
    (protocol === "http" && port === "80") ||
    (protocol === "https" && port === "443");
  if (port && !isStandardPort) {
    reasons.push(`Uses an unusual port (${port}).`);
  }

  if (reasons.length > 0) {
    return {
      level: "caution",
      reasons,
      displayUrl: url.href,
      href: url.href,
    };
  }

  return {
    level: "safe",
    reasons: [],
    displayUrl: url.href,
    href: url.href,
  };
}

export function openExternalLink(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}
