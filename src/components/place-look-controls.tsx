import {
  EDITOR_FONT_SCALE_STEPS,
  editorViewWidthLabel,
  type EditorFontScale,
  type EditorViewWidth,
} from "@/lib/editor-view-prefs";
import type { NoteParagraphSpacing, NotePlaceFont, NotePlaceSettings } from "@/lib/note-place-settings";

const FONTS: { value: NotePlaceFont; label: string }[] = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
];

const LEADING: { value: number; label: string }[] = [
  { value: 1.4, label: "Tight" },
  { value: 1.65, label: "Normal" },
  { value: 1.9, label: "Loose" },
];

const PARAGRAPH: { value: NoteParagraphSpacing; label: string }[] = [
  { value: "tight", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

type PlaceLookControlsProps = {
  settings: NotePlaceSettings;
  onFontChange: (font: NotePlaceFont) => void;
  onFontScaleChange: (scale: EditorFontScale) => void;
  onLineHeightChange: (lineHeight: number) => void;
  onParagraphSpacingChange: (spacing: NoteParagraphSpacing) => void;
  onViewWidthChange: (width: EditorViewWidth) => void;
};

export function PlaceLookControls({
  settings,
  onFontChange,
  onFontScaleChange,
  onLineHeightChange,
  onParagraphSpacingChange,
  onViewWidthChange,
}: PlaceLookControlsProps) {
  const leading = nearestLeading(settings.line_height);

  return (
    <div className="space-y-2">
      <ChipRow
        label="Font"
        options={FONTS}
        value={settings.font}
        onChange={onFontChange}
      />
      <ChipRow
        label="Text size"
        options={EDITOR_FONT_SCALE_STEPS.map((step) => ({ value: step, label: `${step}%` }))}
        value={settings.font_size}
        onChange={onFontScaleChange}
      />
      <ChipRow
        label="Line spacing"
        options={LEADING}
        value={leading}
        onChange={onLineHeightChange}
      />
      <ChipRow
        label="Paragraph"
        options={PARAGRAPH}
        value={settings.paragraph_spacing}
        onChange={onParagraphSpacingChange}
      />
      <ChipRow
        label="Page width"
        options={
          (["comfortable", "tablet", "full"] as const).map((w) => ({
            value: w,
            label: editorViewWidthLabel(w),
          }))
        }
        value={settings.view_width}
        onChange={onViewWidthChange}
      />
    </div>
  );
}

function nearestLeading(value: number): number {
  return LEADING.reduce((best, step) =>
    Math.abs(step.value - value) < Math.abs(best - value) ? step.value : best,
  LEADING[1]!.value);
}

function ChipRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="px-2.5 py-1.5">
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2 py-1 text-[11px] ${
              value === opt.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-primary/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
