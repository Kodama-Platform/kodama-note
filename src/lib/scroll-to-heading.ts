const HEADING_SCROLL_GAP_PX = 12;

export function getEditorHeaderOffset(): number {
  const header = document.querySelector('header[data-editor-chrome="true"]');
  if (header instanceof HTMLElement) {
    return header.getBoundingClientRect().height + HEADING_SCROLL_GAP_PX;
  }

  const scrollPadding = getComputedStyle(document.documentElement).scrollPaddingTop;
  const parsed = parseFloat(scrollPadding);
  return Number.isFinite(parsed) ? parsed + HEADING_SCROLL_GAP_PX : 84;
}

/** Scroll so the element's top sits just below the fixed editor header. */
export function scrollElementBelowHeader(
  element: HTMLElement,
  behavior: ScrollBehavior = "smooth",
) {
  scrollViewportYToHeaderOffset(element.getBoundingClientRect().top, behavior);
}

export function scrollViewportYToHeaderOffset(
  viewportTop: number,
  behavior: ScrollBehavior = "smooth",
) {
  const top = window.scrollY + viewportTop - getEditorHeaderOffset();
  window.scrollTo({ top: Math.max(0, top), behavior });
}

export function resolveHeadingElement(
  view: { nodeDOM: (pos: number) => Node | null; domAtPos: (pos: number) => { node: Node; offset: number } },
  headingPos: number,
): HTMLElement | null {
  const nodeDom = view.nodeDOM(headingPos);
  if (nodeDom instanceof HTMLElement) {
    if (nodeDom.matches("h1,h2,h3,h4,h5,h6")) return nodeDom;
    const nested = nodeDom.querySelector("h1,h2,h3,h4,h5,h6");
    if (nested instanceof HTMLElement) return nested;
    return nodeDom;
  }

  const { node } = view.domAtPos(headingPos + 1);
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : node.parentElement;
  while (el && !el.matches("h1,h2,h3,h4,h5,h6")) {
    el = el.parentElement;
  }
  return el;
}

/** Run after TipTap focus/selection updates so we win over default scroll-into-view. */
export function scheduleScrollBelowHeader(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}
