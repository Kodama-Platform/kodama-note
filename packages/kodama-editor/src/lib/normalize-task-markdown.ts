/**
 * Normalize task-list lines to GFM checkbox syntax that markdown-it-task-lists accepts:
 * `[ ] text` or `[x] text` (space required after the closing bracket).
 */
const TASK_LINE = /^(\s*[-+*]\s+)\[([^\]]*)\](?:\s+(.*)|\s*)$/;

function isTaskBracketContent(inside: string): boolean {
  const core = inside.trim().toLowerCase();
  return core === "" || core === "x";
}

export function normalizeTaskListMarkdown(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const m = TASK_LINE.exec(line);
      if (!m) return line;
      const [, prefix, inside, rest = ""] = m;
      if (!isTaskBracketContent(inside)) return line;
      const checked = inside.trim().toLowerCase() === "x";
      const marker = checked ? "[x]" : "[ ]";
      return rest ? `${prefix}${marker} ${rest}` : `${prefix}${marker}`;
    })
    .join("\n");
}

export function markdownLikelyHasTaskLists(text: string): boolean {
  return /^\s*[-+*]\s+\[[^\]]*\]/m.test(text);
}
