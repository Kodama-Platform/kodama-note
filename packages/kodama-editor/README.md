# `@kodama.page/editor`

Shared live Markdown editor (TipTap) with floating format toolbar and slash menu.

Used by Kodama Note, Public Post, Public Message, and other products.

```tsx
import { KodamaEditor } from "@kodama.page/editor";
import "@kodama.page/editor/styles.css";

<KodamaEditor
  value={markdown}
  onChange={setMarkdown}
  editable
  toolbar="floating"
  theme={{
    mode: "dark",
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontSize: 18,
    backgroundColor: "#1C1E1A",
    textColor: "#C4BDB0",
    highlightColor: "rgba(120, 160, 100, 0.35)",
    selectionColor: "rgba(120, 160, 100, 0.28)",
    primaryColor: "#7A9E6E",
  }}
/>
```

## Theme tokens (`theme` prop)

| Field | Maps to | Purpose |
|-------|---------|---------|
| `mode` | `.dark` on root | Light / dark chrome selectors |
| `fontFamily` | `--ke-font-body` | Body text |
| `headingFontFamily` | `--ke-font-display` | Headings |
| `monoFontFamily` | `--ke-font-mono` | Code |
| `fontSize` | `--ke-font-size` | Base size (number = px) |
| `backgroundColor` | `--ke-bg` | Writing surface |
| `textColor` | `--ke-fg` | Text / caret |
| `mutedColor` | `--ke-muted` | Quotes, placeholder |
| `highlightColor` | `--ke-highlight` | `==mark==` |
| `selectionColor` | `--ke-selection` | Selection wash |
| `primaryColor` | `--ke-primary` | Links, accents |
| `borderColor` | `--ke-border` | Borders |
| `surfaceColor` | `--ke-surface` | Toolbar / slash |
| `cssVariables` | passthrough | Escape hatch |

Omitted fields inherit host CSS. Portal chrome (floating toolbar / slash) receives the same vars.

## Playground

```bash
yarn dev:editor
```
