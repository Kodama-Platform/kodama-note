import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import type { RichEditorHandle } from "@/components/rich-editor";

export function FindReplace({
  text,
  onReplace,
  onClose,
  editorRef,
  initialMode = "find",
}: {
  text: string;
  onReplace: (next: string) => void;
  onClose: () => void;
  editorRef: React.RefObject<RichEditorHandle | null>;
  initialMode?: "find" | "replace";
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(initialMode === "replace");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const matches = useMemo(() => {
    if (!query) return [] as number[];
    const out: number[] = [];
    const q = query.toLowerCase();
    const hay = text.toLowerCase();
    let i = hay.indexOf(q);
    while (i !== -1) {
      out.push(i);
      i = hay.indexOf(q, i + Math.max(1, q.length));
    }
    return out;
  }, [text, query]);

  useEffect(() => {
    if (matches.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((idx) => Math.min(idx, matches.length - 1));
  }, [matches.length]);

  const selectMatch = (i: number) => {
    if (matches.length === 0) return;
    const safeIdx = ((i % matches.length) + matches.length) % matches.length;
    const start = matches[safeIdx];
    editorRef.current?.findInDocument(query, start);
    setIndex(safeIdx);
  };

  const next = () => selectMatch(index + 1);
  const prev = () => selectMatch(index - 1);

  const replaceOne = () => {
    if (matches.length === 0 || !query) return;
    const nextText = editorRef.current?.replaceInMarkdown(query, replacement, index);
    if (nextText != null) onReplace(nextText);
  };

  const replaceAll = () => {
    if (!query) return;
    const nextText = editorRef.current?.replaceAllInMarkdown(query, replacement) ?? text.replace(
      new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      replacement,
    );
    onReplace(nextText);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed right-3 top-[4.5rem] z-40 w-[min(420px,calc(100vw-1.5rem))] rounded-2xl border border-border/80 bg-card/95 p-3 shadow-card backdrop-blur-md sm:right-5 lg:top-20">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Find"
          className="note-input !h-9 flex-1"
        />
        <span className="min-w-[3.5rem] text-right text-[11px] text-muted-foreground">
          {matches.length === 0 ? "0 / 0" : `${index + 1} / ${matches.length}`}
        </span>
        <IconBtn onClick={prev} label="Previous">
          <ChevronUp className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={next} label="Next">
          <ChevronDown className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={() => setShowReplace((v) => !v)} label="Toggle replace" pressed={showReplace}>
          <Replace className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={onClose} label="Close">
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      {showReplace && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={onKey}
            placeholder="Replace with"
            className="note-input !h-9 flex-1"
          />
          <button
            onClick={replaceOne}
            className="note-toolbar-btn !h-9"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            className="btn-moss !h-9 !px-3 !py-0 !text-xs"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  pressed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`note-toolbar-btn !h-9 !w-9 !px-0 ${pressed ? "!border-primary/35 !bg-primary/10" : ""}`}
    >
      {children}
    </button>
  );
}
