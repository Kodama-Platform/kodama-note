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
/>
```

Run the standalone playground from the repo root:

```bash
yarn dev:editor
```
