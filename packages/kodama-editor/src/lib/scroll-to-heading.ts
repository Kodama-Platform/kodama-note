const HEADING_SCROLL_GAP_PX = 12;

/** Nearest ancestor that actually scrolls (overflow + content taller than box). */
export function findNearestScrollable(start: Element | null): HTMLElement | null {
  let el: Element | null = start;
  while (el && el !== document.documentElement) {
    if (el instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(el);
      const canScroll =
        overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (canScroll && el.scrollHeight > el.clientHeight + 1) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

/** Prefer a live scrollable ancestor; fall back to known editor shells. */
export function getEditorScrollContainer(from?: Element | null): HTMLElement | null {
  const stage = document.querySelector('[data-editor-stage="true"]');
  if (stage instanceof HTMLElement && stage.scrollHeight > stage.clientHeight + 1) {
    return stage;
  }

  const nearest = findNearestScrollable(from ?? stage);
  if (nearest) return nearest;

  if (stage instanceof HTMLElement) return stage;

  const surface = document.querySelector('[data-editor-scroll="true"]');
  return surface instanceof HTMLElement ? surface : null;
}

export function getEditorHeaderOffset(): number {
  const header = document.querySelector('header[data-editor-chrome="true"]');
  let offset = 0;
  if (header instanceof HTMLElement) {
    offset += header.getBoundingClientRect().height;
  }
  if (offset > 0) {
    return offset + HEADING_SCROLL_GAP_PX;
  }

  const scrollPadding = getComputedStyle(document.documentElement).scrollPaddingTop;
  const parsed = parseFloat(scrollPadding);
  return Number.isFinite(parsed) ? parsed + HEADING_SCROLL_GAP_PX : 64;
}

/** Product of CSS `zoom` between element and ancestor (1 when none). */
export function cumulativeZoom(element: HTMLElement, stopAt: HTMLElement): number {
  let zoom = 1;
  let el: HTMLElement | null = element;
  while (el && el !== stopAt) {
    const raw = getComputedStyle(el).zoom;
    if (raw && raw !== "normal") {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) zoom *= n;
    }
    el = el.parentElement;
  }
  return zoom;
}

function scrollContainerByDelta(
  container: HTMLElement,
  element: HTMLElement,
  behavior: ScrollBehavior,
) {
  // Both rects are viewport pixels. CSS zoom on a *descendant* is already
  // reflected in layout/scrollHeight for Chromium — don't divide again.
  const delta =
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top -
    HEADING_SCROLL_GAP_PX;
  const next = Math.max(0, container.scrollTop + delta);
  if (typeof container.scrollTo === "function") {
    container.scrollTo({ top: next, behavior });
  } else {
    container.scrollTop = next;
  }
}

/**
 * Pin a heading to the top of the writing viewport.
 * Tries the editor stage, any scrollable ancestor, then the window.
 */
export function scrollElementBelowHeader(
  element: HTMLElement,
  behavior: ScrollBehavior = "auto",
) {
  const stage = document.querySelector('[data-editor-stage="true"]');
  const container =
    (stage instanceof HTMLElement ? stage : null) ??
    findNearestScrollable(element) ??
    getEditorScrollContainer(element);

  if (container) {
    scrollContainerByDelta(container, element, behavior);
  }

  // If the stage isn't the real scroller (flex height broken), the window moves instead.
  const headerOffset = getEditorHeaderOffset();
  const afterTop = element.getBoundingClientRect().top;
  if (afterTop > headerOffset + 36 || afterTop < headerOffset - 8) {
    const top = window.scrollY + afterTop - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }

  // Last resort — native pin, then nudge under the fixed header.
  const finalTop = element.getBoundingClientRect().top;
  if (finalTop > headerOffset + 48 || finalTop < headerOffset - 8) {
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "start", behavior: "auto", inline: "nearest" });
    }
    const nudged = element.getBoundingClientRect().top;
    if (nudged < headerOffset && typeof window.scrollBy === "function") {
      window.scrollBy(0, nudged - headerOffset);
    }
  }
}

export function scrollViewportYToHeaderOffset(
  viewportTop: number,
  behavior: ScrollBehavior = "auto",
) {
  const top = window.scrollY + viewportTop - getEditorHeaderOffset();
  window.scrollTo({ top: Math.max(0, top), behavior });
}

export function resolveHeadingElement(
  view: {
    nodeDOM: (pos: number) => Node | null;
    domAtPos: (pos: number) => { node: Node; offset: number };
    dom: Element;
  },
  headingPos: number,
): HTMLElement | null {
  const nodeDom = view.nodeDOM(headingPos);
  if (nodeDom instanceof HTMLElement) {
    if (nodeDom.matches("h1,h2,h3,h4,h5,h6")) return nodeDom;
    const nested = nodeDom.querySelector("h1,h2,h3,h4,h5,h6");
    if (nested instanceof HTMLElement) return nested;
    return nodeDom;
  }

  try {
    const { node } = view.domAtPos(headingPos + 1);
    let el: HTMLElement | null =
      node instanceof HTMLElement ? node : node.parentElement;
    while (el && !el.matches("h1,h2,h3,h4,h5,h6")) {
      el = el.parentElement;
    }
    if (el) return el;
  } catch {
    // pos may be invalid during teardown
  }

  return null;
}

/** Run after TipTap focus/selection updates so we win over default scroll-into-view. */
export function scheduleScrollBelowHeader(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}
