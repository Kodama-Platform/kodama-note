import {
  KODAMA_APPLE_TOUCH_ICON_URL,
  KODAMA_FAVICON_URL,
  KODAMA_MARK_URL,
} from "@/lib/brand";

type FaviconSpec = {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
};

const FAVICON_VERSION = "2";

function withVersion(path: string) {
  return `${path}?v=${FAVICON_VERSION}`;
}

const FAVICON_LINKS: FaviconSpec[] = [
  { rel: "icon", href: withVersion(KODAMA_MARK_URL), type: "image/svg+xml" },
  { rel: "icon", href: withVersion("/favicon-32.png"), type: "image/png", sizes: "32x32" },
  { rel: "icon", href: withVersion(KODAMA_FAVICON_URL), type: "image/x-icon" },
  { rel: "shortcut icon", href: withVersion(KODAMA_FAVICON_URL), type: "image/x-icon" },
  { rel: "apple-touch-icon", href: withVersion(KODAMA_APPLE_TOUCH_ICON_URL) },
];

export function setupFavicon() {
  for (const spec of FAVICON_LINKS) {
    let selector = `link[rel="${spec.rel}"]`;
    if (spec.type) selector += `[type="${spec.type}"]`;
    if (spec.sizes) selector += `[sizes="${spec.sizes}"]`;
    if (document.head.querySelector(selector)) continue;

    const link = document.createElement("link");
    link.rel = spec.rel;
    link.href = spec.href;
    if (spec.type) link.type = spec.type;
    if (spec.sizes) link.sizes = spec.sizes;
    document.head.appendChild(link);
  }

  if (!document.head.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "/manifest.json";
    document.head.appendChild(manifest);
  }
}
