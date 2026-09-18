import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import type { EditorFontScale, EditorViewWidth } from "@/lib/editor-view-prefs";
import type { NoteAppearance } from "@/lib/note-appearance";
import {
  appearanceFromSettings,
  cachePlaceSettings,
  normalizeNotePlaceSettings,
  resolveInitialPlaceSettings,
  settingsWithAppearance,
  type NoteParagraphSpacing,
  type NotePlaceFont,
  type NotePlaceSettings,
} from "@/lib/note-place-settings";
import { getPlaceSettings, putPlaceSettings } from "@/lib/place-public-api";
import { isPlaintextMode } from "@/lib/plaintext-mode";

const SAVE_MS = 400;

export function usePlaceSettings(args: {
  slug: string;
  crypto: PlaceCryptoSession;
  canPersist: boolean;
  initial?: NotePlaceSettings | null;
}) {
  const { slug, crypto, canPersist, initial } = args;
  const [settings, setSettings] = useState<NotePlaceSettings>(() =>
    resolveInitialPlaceSettings(slug, initial),
  );
  const pendingRef = useRef<NotePlaceSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initial) {
      const next = normalizeNotePlaceSettings(initial);
      setSettings(next);
      cachePlaceSettings(slug, next);
      return;
    }
    if (isPlaintextMode()) return;
    let cancelled = false;
    void getPlaceSettings(slug)
      .then((loaded) => {
        if (cancelled || pendingRef.current) return;
        setSettings(loaded);
        cachePlaceSettings(slug, loaded);
      })
      .catch(() => {
        /* keep device / cached defaults when the gate is down */
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initial]);

  const flush = useCallback(
    async (next: NotePlaceSettings) => {
      if (!canPersist || crypto.kind !== "knp" || crypto.session.role !== "owner") return;
      try {
        const saved = await putPlaceSettings({
          slug,
          settings: next,
          session: crypto.session,
        });
        cachePlaceSettings(slug, saved);
        setSettings(saved);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save page look");
      }
    },
    [canPersist, crypto, slug],
  );

  const commit = useCallback(
    (next: NotePlaceSettings) => {
      const normalized = normalizeNotePlaceSettings(next);
      pendingRef.current = normalized;
      setSettings(normalized);
      cachePlaceSettings(slug, normalized);
      if (!canPersist) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        timerRef.current = null;
        if (pending) void flush(pending);
      }, SAVE_MS);
    },
    [canPersist, flush, slug],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      if (pending) void flush(pending);
    },
    [flush],
  );

  const appearance = useMemo(() => appearanceFromSettings(settings), [settings]);

  const changeAppearance = useCallback(
    (next: NoteAppearance) => {
      commit(settingsWithAppearance(settings, next));
    },
    [commit, settings],
  );

  const changeFontScale = useCallback(
    (font_size: EditorFontScale) => {
      commit({ ...settings, font_size });
    },
    [commit, settings],
  );

  const changeViewWidth = useCallback(
    (view_width: EditorViewWidth) => {
      commit({ ...settings, view_width });
    },
    [commit, settings],
  );

  const changeFont = useCallback(
    (font: NotePlaceFont) => {
      commit({ ...settings, font, font_family: null });
    },
    [commit, settings],
  );

  const changeLineHeight = useCallback(
    (line_height: number) => {
      commit({ ...settings, line_height });
    },
    [commit, settings],
  );

  const changeParagraphSpacing = useCallback(
    (paragraph_spacing: NoteParagraphSpacing) => {
      commit({ ...settings, paragraph_spacing });
    },
    [commit, settings],
  );

  const changeLetterSpacing = useCallback(
    (letter_spacing: number) => {
      commit({ ...settings, letter_spacing });
    },
    [commit, settings],
  );

  return {
    settings,
    appearance,
    changeAppearance,
    changeFontScale,
    changeViewWidth,
    changeFont,
    changeLineHeight,
    changeParagraphSpacing,
    changeLetterSpacing,
  };
}
