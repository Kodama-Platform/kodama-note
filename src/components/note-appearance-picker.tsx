import { Palette } from "lucide-react";

import {
  NOTE_APPEARANCE_PRESETS,
  type NoteAppearance,
  type NoteAppearancePreset,
} from "@/lib/note-appearance";

const PRESET_ORDER: Exclude<NoteAppearancePreset, "custom">[] = [
  "default",
  "paper",
  "ink",
  "sepia",
  "dusk",
  "moss",
];

type NoteAppearancePickerProps = {
  value: NoteAppearance;
  onChange: (next: NoteAppearance) => void;
  /** Compact layout for menus. */
  compact?: boolean;
};

export function NoteAppearancePicker({
  value,
  onChange,
  compact = false,
}: NoteAppearancePickerProps) {
  return (
    <div className={compact ? "space-y-2 px-1.5 py-1" : "space-y-3"}>
      <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        <Palette className="h-3 w-3" />
        Note colors
      </div>
      <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {PRESET_ORDER.map((id) => {
          const preset = NOTE_APPEARANCE_PRESETS[id];
          const active = value.preset === id;
          const swatch = preset.dark;
          return (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onChange({ preset: id })}
              className={`flex flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors ${
                active
                  ? "border-primary/45 bg-primary/10"
                  : "border-border/60 hover:border-primary/30 hover:bg-primary/5"
              }`}
              title={preset.hint}
            >
              <span
                className="flex h-6 w-full items-center justify-center rounded-md border border-black/10 text-[10px] font-medium"
                style={{
                  background:
                    swatch.background === "transparent" ? "#1C1E1A" : swatch.background,
                  color: swatch.text,
                }}
              >
                Aa
              </span>
              <span className="text-[11px] font-medium text-foreground">{preset.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={value.preset === "custom"}
          onClick={() =>
            onChange({
              preset: "custom",
              background: value.background ?? "#1C1E1A",
              text: value.text ?? "#C9C3B6",
            })
          }
          className={`flex flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors ${
            value.preset === "custom"
              ? "border-primary/45 bg-primary/10"
              : "border-border/60 hover:border-primary/30 hover:bg-primary/5"
          }`}
        >
          <span className="flex h-6 w-full items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
            Custom
          </span>
          <span className="text-[11px] font-medium text-foreground">Custom</span>
        </button>
      </div>

      {value.preset === "custom" && (
        <div className="grid grid-cols-2 gap-2 px-1 pt-1">
          <label className="block space-y-1">
            <span className="block text-[10px] text-muted-foreground">Background</span>
            <input
              type="color"
              value={value.background ?? "#1C1E1A"}
              onChange={(e) =>
                onChange({
                  preset: "custom",
                  background: e.target.value,
                  text: value.text ?? "#C9C3B6",
                })
              }
              className="h-9 w-full cursor-pointer rounded-md border border-border/70 bg-transparent p-1"
              aria-label="Note background color"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-[10px] text-muted-foreground">Text</span>
            <input
              type="color"
              value={value.text ?? "#C9C3B6"}
              onChange={(e) =>
                onChange({
                  preset: "custom",
                  background: value.background ?? "#1C1E1A",
                  text: e.target.value,
                })
              }
              className="h-9 w-full cursor-pointer rounded-md border border-border/70 bg-transparent p-1"
              aria-label="Note text color"
            />
          </label>
        </div>
      )}
    </div>
  );
}
