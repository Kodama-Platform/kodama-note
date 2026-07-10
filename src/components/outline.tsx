import { useMemo } from "react";
import { ListTree } from "lucide-react";

type Heading = { level: number; text: string; offset: number };

function parseHeadings(text: string): Heading[] {
  const out: Heading[] = [];
  const lines = text.split("\n");
  let offset = 0;
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2], offset });
    offset += line.length + 1; // +1 for newline
  }
  return out;
}

export function Outline({
  text,
  textareaRef,
  onJump,
}: {
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onJump?: () => void;
}) {
  const headings = useMemo(() => parseHeadings(text), [text]);

  const jump = (h: Heading) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(h.offset, h.offset + h.text.length + h.level + 1);
    const line = text.slice(0, h.offset).split("\n").length;
    const approxLineHeight = 28;
    ta.scrollTop = Math.max(0, line * approxLineHeight - 80);
    onJump?.();
  };

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border/60 pr-4 md:block">
      <div className="sticky top-20">
        <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
          <ListTree className="h-3 w-3" /> Outline
        </div>
        {headings.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">
            Add <code className="rounded bg-muted px-1">#</code> headings to build an outline.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.level - 1) * 10 }}>
                <button
                  onClick={() => jump(h)}
                  className="block w-full truncate rounded px-1.5 py-1 text-left text-xs font-light text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground"
                  title={h.text}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
