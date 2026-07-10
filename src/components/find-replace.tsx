import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, Search, X } from "lucide-react";
import type { RichEditorHandle } from "@/components/rich-editor";

export function FindReplace({
  contentKey,
  onClose,
  editorRef,
  initialMode = "find",
}: {
  contentKey: string;
  onClose: () => void;
  editorRef: React.RefObject<RichEditorHandle | null>;
  initialMode?: "find" | "replace";
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(initialMode === "replace");
  const [index, setIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const refreshMatchCount = useCallback(() => {
    const count = editorRef.current?.countFindMatches(query) ?? 0;
    setMatchCount(count);
    return count;
  }, [editorRef, query]);

  useEffect(() => {
    const count = refreshMatchCount();
    if (!query || count === 0) {
      setIndex(0);
      return;
    }
    setIndex(0);
    editorRef.current?.findMatchAt(query, 0);
  }, [query, contentKey, refreshMatchCount, editorRef]);

  useEffect(() => {
    if (matchCount === 0) {
      setIndex(0);
      return;
    }
    setIndex((idx) => Math.min(idx, matchCount - 1));
  }, [matchCount]);

  const selectMatch = (i: number) => {
    if (matchCount === 0 || !query) return;
    const safeIdx = ((i % matchCount) + matchCount) % matchCount;
    editorRef.current?.findMatchAt(query, safeIdx);
    setIndex(safeIdx);
  };

  const next = () => selectMatch(index + 1);
  const prev = () => selectMatch(index - 1);

  const replaceOne = () => {
    if (matchCount === 0 || !query) return;
    const replaced = editorRef.current?.replaceMatchAt(query, replacement, index);
    if (!replaced) return;
    const count = refreshMatchCount();
    if (count === 0) {
      setIndex(0);
      return;
    }
    const nextIdx = Math.min(index, count - 1);
    setIndex(nextIdx);
    editorRef.current?.findMatchAt(query, nextIdx);
  };

  const replaceAll = () => {
    if (!query) return;
    editorRef.current?.replaceAllMatches(query, replacement);
    refreshMatchCount();
    setIndex(0);
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
    <div
      className="note-find-panel fixed right-3 top-[4.5rem] z-40 w-[min(440px,calc(100vw-1.5rem))] sm:right-5 lg:top-20"
      role="dialog"
      aria-label="Find in note"
    >
      <div className="note-find-panel-header">
        <div className="flex items-center gap-2 font-display text-sm font-medium text-foreground">
          <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          Find in note
        </div>
        <button
          type="button"
          onClick={onClose}
          className="note-sheet-tab-action !opacity-60 hover:!opacity-100"
          aria-label="Close find"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="note-find-panel-body">
        <label className="block space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Search
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Find in this sheet"
              className="note-input flex-1"
              spellCheck={false}
            />
            <span className="min-w-[3.25rem] text-right font-mono text-[11px] text-muted-foreground">
              {matchCount === 0 ? "0 / 0" : `${index + 1} / ${matchCount}`}
            </span>
          </div>
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="note-find-actions" role="group" aria-label="Match navigation">
              <IconBtn onClick={prev} label="Previous match" disabled={matchCount === 0}>
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconBtn>
              <IconBtn onClick={next} label="Next match" disabled={matchCount === 0}>
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconBtn>
            </div>
            <button
              type="button"
              onClick={() => setShowReplace((v) => !v)}
              aria-label="Toggle replace"
              aria-pressed={showReplace}
              title="Replace"
              className="note-toolbar-btn !h-8"
            >
              <Replace className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Replace</span>
            </button>
          </div>
          <p className="shrink-0 text-[11px] text-muted-foreground">
            Enter next · Shift+Enter prev
          </p>
        </div>

        {showReplace && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Replace with
              </span>
              <input
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                onKeyDown={onKey}
                placeholder="Replacement text"
                className="note-input"
                spellCheck={false}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={replaceOne}
                disabled={matchCount === 0 || !query}
                className="note-toolbar-btn !h-8 disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={replaceAll}
                disabled={!query}
                className="btn-moss !h-8 !px-3 !py-0 !text-xs disabled:opacity-50"
              >
                Replace all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="note-find-action-btn"
    >
      {children}
    </button>
  );
}
