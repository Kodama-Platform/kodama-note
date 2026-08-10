import { useMemo, useRef, useState } from "react";
import {
  KodamaEditor,
  type KodamaEditorHandle,
  type KodamaEditorToolbar,
} from "@kodama.page/editor";
import "@kodama.page/editor/styles.css";

const SAMPLE = `# Welcome to Kodama Editor

Shared live Markdown for **Note**, Public Post, Public Message, and more.

## Try it

- Select text for the floating toolbar
- Type \`/\` for the slash menu
- Use \`Ctrl/Cmd + K\` for links

### Checklist

- [x] Floating format toolbar
- [ ] Your next idea

> Write freely — products own save and crypto.
`;

export function App() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [editable, setEditable] = useState(true);
  const [toolbar, setToolbar] = useState<KodamaEditorToolbar>("floating");
  const [showSource, setShowSource] = useState(false);
  const editorRef = useRef<KodamaEditorHandle>(null);

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [markdown]);

  return (
    <div className="playground">
      <header className="playground-header">
        <div>
          <p className="eyebrow">@kodama.page/editor</p>
          <h1>Kodama Editor</h1>
          <p className="lede">Standalone playground — yarn dev:editor</p>
        </div>
        <div className="controls">
          <label>
            <input
              type="checkbox"
              checked={editable}
              onChange={(e) => setEditable(e.target.checked)}
            />
            Editable
          </label>
          <label>
            Toolbar
            <select
              value={toolbar}
              onChange={(e) => setToolbar(e.target.value as KodamaEditorToolbar)}
            >
              <option value="floating">floating</option>
              <option value="static">static</option>
              <option value="none">none</option>
            </select>
          </label>
          <button type="button" onClick={() => setShowSource((v) => !v)}>
            {showSource ? "Hide source" : "Show source"}
          </button>
          <button type="button" onClick={() => editorRef.current?.focus()}>
            Focus
          </button>
        </div>
      </header>

      <main className="playground-main" data-editor-scroll="true">
        <KodamaEditor
          ref={editorRef}
          value={markdown}
          onChange={setMarkdown}
          editable={editable}
          toolbar={toolbar}
          placeholder="Start a public post, message, or note…"
        />
      </main>

      <footer className="playground-footer">
        <span>{wordCount} words</span>
        <span>{markdown.length} chars</span>
      </footer>

      {showSource ? (
        <aside className="playground-source">
          <pre>{markdown}</pre>
        </aside>
      ) : null}
    </div>
  );
}