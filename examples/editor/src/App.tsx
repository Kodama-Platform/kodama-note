import { useMemo, useRef, useState } from "react";
import {
  KodamaEditor,
  type KodamaEditorHandle,
  type KodamaEditorTheme,
  type KodamaEditorToolbar,
} from "@kodama.page/editor";
import "@kodama.page/editor/styles.css";

const SAMPLE = `# Welcome to Kodama Editor

Shared live Markdown for **Note**, Public Post, Public Message, and more.

## Try it

- Select text for the floating toolbar
- Type \`/\` for the slash menu
- Use \`Ctrl/Cmd + K\` for links
- Toggle themes below

### Checklist

- [x] Floating format toolbar
- [x] Customizable theme tokens
- [ ] Your next idea

> Write freely — products own save and crypto.

Highlight with ==marks== and [links](https://kodama.page).
`;

type PresetId = "default" | "paper" | "ink" | "dusk" | "post";

const PRESETS: Record<
  PresetId,
  { label: string; theme: KodamaEditorTheme }
> = {
  default: {
    label: "Default",
    theme: {
      mode: "light",
      fontFamily: '"Source Serif 4", Georgia, serif',
      headingFontFamily: "Fraunces, Georgia, serif",
      fontSize: 18,
      backgroundColor: "transparent",
      textColor: "#3A3730",
      mutedColor: "#7A756B",
      primaryColor: "#4A6E48",
      highlightColor: "rgba(74, 110, 72, 0.22)",
      selectionColor: "rgba(74, 110, 72, 0.22)",
      surfaceColor: "rgba(255, 253, 248, 0.97)",
      borderColor: "rgba(210, 204, 190, 0.7)",
    },
  },
  paper: {
    label: "Paper",
    theme: {
      mode: "light",
      fontFamily: '"Source Serif 4", Georgia, serif',
      headingFontFamily: "Fraunces, Georgia, serif",
      fontSize: 18,
      backgroundColor: "#F3EFE6",
      textColor: "#3A3730",
      mutedColor: "#7A756B",
      primaryColor: "#5C6B4A",
      highlightColor: "rgba(180, 140, 60, 0.28)",
      selectionColor: "rgba(120, 140, 80, 0.24)",
      surfaceColor: "#FFFdf8",
      borderColor: "rgba(180, 168, 140, 0.65)",
    },
  },
  ink: {
    label: "Ink",
    theme: {
      mode: "light",
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      headingFontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      fontSize: 17,
      backgroundColor: "#F7F6F3",
      textColor: "#2C2A26",
      mutedColor: "#6E6A62",
      primaryColor: "#2F5D8C",
      highlightColor: "rgba(47, 93, 140, 0.18)",
      selectionColor: "rgba(47, 93, 140, 0.2)",
      surfaceColor: "#FFFFFF",
      borderColor: "rgba(180, 180, 180, 0.7)",
    },
  },
  dusk: {
    label: "Dusk",
    theme: {
      mode: "dark",
      fontFamily: '"Source Serif 4", Georgia, serif',
      headingFontFamily: "Fraunces, Georgia, serif",
      fontSize: 18,
      backgroundColor: "#1C1E1A",
      textColor: "#C4BDB0",
      mutedColor: "#8A8478",
      primaryColor: "#8FB389",
      highlightColor: "rgba(143, 179, 137, 0.28)",
      selectionColor: "rgba(143, 179, 137, 0.32)",
      surfaceColor: "rgba(36, 40, 36, 0.98)",
      borderColor: "rgba(90, 96, 90, 0.65)",
    },
  },
  post: {
    label: "Public Post",
    theme: {
      mode: "light",
      fontFamily: "Georgia, \"Times New Roman\", serif",
      headingFontFamily: "Georgia, \"Times New Roman\", serif",
      fontSize: 19,
      backgroundColor: "#FFFAF2",
      textColor: "#1A1A1A",
      mutedColor: "#6B6560",
      primaryColor: "#B45309",
      highlightColor: "rgba(234, 179, 8, 0.35)",
      selectionColor: "rgba(180, 83, 9, 0.18)",
      surfaceColor: "#FFFFFF",
      borderColor: "rgba(180, 140, 100, 0.55)",
    },
  },
};

export function App() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [editable, setEditable] = useState(true);
  const [toolbar, setToolbar] = useState<KodamaEditorToolbar>("floating");
  const [preset, setPreset] = useState<PresetId>("default");
  const [showSource, setShowSource] = useState(false);
  const editorRef = useRef<KodamaEditorHandle>(null);

  const theme = PRESETS[preset].theme;

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [markdown]);

  return (
    <div className={`playground${theme.mode === "dark" ? " playground--dark" : ""}`}>
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
          <label>
            Theme
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PresetId)}
            >
              {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                <option key={id} value={id}>
                  {PRESETS[id].label}
                </option>
              ))}
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

      <main className="playground-main">
        <KodamaEditor
          ref={editorRef}
          value={markdown}
          onChange={setMarkdown}
          editable={editable}
          toolbar={toolbar}
          theme={theme}
          placeholder="Start a public post, message, or note…"
        />
      </main>

      <footer className="playground-footer">
        <span>{wordCount} words</span>
        <span>{markdown.length} chars</span>
        <span>
          {theme.mode ?? "light"}
          {theme.fontSize != null
            ? ` · ${typeof theme.fontSize === "number" ? `${theme.fontSize}px` : theme.fontSize}`
            : ""}
        </span>
      </footer>

      {showSource ? (
        <aside className="playground-source">
          <pre>{markdown}</pre>
        </aside>
      ) : null}
    </div>
  );
}