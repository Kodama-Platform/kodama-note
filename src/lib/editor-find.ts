import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

import {
  getEditorScrollContainer,
  scheduleScrollBelowHeader,
} from "@/lib/scroll-to-heading";

const FIND_SCROLL_GAP_PX = 12;

export type TextMatch = { from: number; to: number };

type TextSegment = { from: number; text: string };

function collectTextSegments(doc: ProseMirrorNode): TextSegment[] {
  const segments: TextSegment[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segments.push({ from: pos, text: node.text });
    }
  });
  return segments;
}

export function textOffsetToPos(segments: TextSegment[], offset: number): number {
  if (offset < 0) return -1;
  let charCount = 0;
  for (const seg of segments) {
    const next = charCount + seg.text.length;
    if (offset < next) {
      return seg.from + (offset - charCount);
    }
    if (offset === next) {
      charCount = next;
      continue;
    }
    charCount = next;
  }
  if (segments.length > 0 && offset === charCount) {
    const last = segments[segments.length - 1];
    return last.from + last.text.length;
  }
  return -1;
}

export function collectTextMatches(doc: ProseMirrorNode, query: string): TextMatch[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const segments = collectTextSegments(doc);
  const plain = segments.map((s) => s.text).join("");
  const lower = plain.toLowerCase();
  const matches: TextMatch[] = [];
  let i = lower.indexOf(q);
  while (i !== -1) {
    const from = textOffsetToPos(segments, i);
    const to = textOffsetToPos(segments, i + query.length);
    if (from !== -1 && to !== -1 && to > from) {
      matches.push({ from, to });
    }
    i = lower.indexOf(q, i + Math.max(1, q.length));
  }
  return matches;
}

export function selectTextMatch(editor: Editor, match: TextMatch) {
  editor
    .chain()
    .focus()
    .setTextSelection({ from: match.from, to: match.to })
    .run();

  scheduleScrollBelowHeader(() => {
    const coords = editor.view.coordsAtPos(match.from);
    const container = getEditorScrollContainer();
    if (container) {
      const containerTop = container.getBoundingClientRect().top;
      const top = container.scrollTop + (coords.top - containerTop) - FIND_SCROLL_GAP_PX;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }
    const top = window.scrollY + coords.top - FIND_SCROLL_GAP_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  });
}

export function replaceTextMatch(editor: Editor, match: TextMatch, replacement: string) {
  editor.chain().focus().insertText(replacement, match.from, match.to).run();
}

export function replaceAllTextMatches(editor: Editor, query: string, replacement: string) {
  const matches = collectTextMatches(editor.state.doc, query);
  if (matches.length === 0) return;
  let tr = editor.state.tr;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    tr = tr.insertText(replacement, m.from, m.to);
  }
  editor.view.dispatch(tr);
  editor.commands.focus();
}
