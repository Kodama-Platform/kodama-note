import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import type { KodamaEditorThemeStyle } from "./theme";

const EditorThemeStyleContext = createContext<KodamaEditorThemeStyle>({});

export function EditorThemeStyleProvider({
  value,
  children,
}: {
  value: KodamaEditorThemeStyle;
  children: ReactNode;
}) {
  return (
    <EditorThemeStyleContext.Provider value={value}>{children}</EditorThemeStyleContext.Provider>
  );
}

/** Theme CSS vars for portal chrome (toolbar / slash) that render outside the editor root. */
export function useEditorThemeStyle(): CSSProperties {
  return useContext(EditorThemeStyleContext);
}