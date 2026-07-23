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
    offset += line.length + 1;
  }
  return out;
}

export function Outline({
  text,
  onJumpToHeading,
  onJump,
}: {
  text: string;
  onJumpToHeading?: (heading: string) => void;
  onJump?: () => void;
}) {
  const headings = useMemo(() => parseHeadings(text), [text]);

  const jump = (h: Heading) => {
    onJumpToHeading?.(h.text);
    onJump?.();
  };

  return (
    <aside
      data-editor-outline="true"
      className="hidden h-full min-h-0 w-48 shrink-0 self-stretch overflow-y-auto border-r border-border/40 pr-3 opacity-80 transition-opacity hover:opacity-100 md:block lg:w-52"
    >
      <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
        <ListTree className="h-3 w-3" /> Outline
      </div>
      {headings.length === 0 ? (
        <p className="text-[11px] font-light leading-relaxed text-muted-foreground/60">
          Headings appear here as you write.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h, i) => (
            <li key={i} style={{ paddingLeft: (h.level - 1) * 8 }}>
              <button
                onClick={() => jump(h)}
                className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-light text-muted-foreground/80 transition-colors hover:bg-primary/5 hover:text-foreground"
                title={h.text}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
