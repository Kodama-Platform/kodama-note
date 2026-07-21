import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VERSIONING_ENABLED } from "@/lib/features";

const describeVersioning = VERSIONING_ENABLED ? describe : describe.skip;

const appendCalls: Array<{
  slug: string;
  ciphertext: string;
  iv: string;
  ksp: boolean;
}> = [];

vi.mock("@/lib/legacy-edit", () => ({
  readLegacyEditToken: vi.fn(() => "legacy-edit-token"),
}));

vi.mock("@/lib/pages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pages")>();
  return {
    ...actual,
    savePage: vi.fn(async (args: {
      slug: string;
      ciphertext: string;
      iv: string;
      ksp: boolean;
    }) => {
      appendCalls.push(args);
      return { id: `v-${appendCalls.length}`, created_at: new Date().toISOString() };
    }),
    listVersions: vi.fn(async () => [
      {
        id: "v-old",
        ciphertext: "OLD_CIPHERTEXT",
        iv: "OLD_IV",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ]),
    listAttachments: vi.fn(async () => []),
    registerAttachment: vi.fn(),
    uploadAttachmentBlob: vi.fn(),
    downloadAttachmentBlob: vi.fn(),
  };
});

vi.mock("@/lib/crypto-context", () => ({
  encryptPlaceWorkbookForSave: vi.fn(async (_session: unknown, plaintext: string) => ({
    ciphertext: `CT(${plaintext})`,
    iv: "IV",
    session: _session,
  })),
  encryptPlaceText: vi.fn(async (_session: unknown, plaintext: string) => ({
    ciphertext: `CT(${plaintext})`,
    iv: "IV",
  })),
  decryptPlaceText: vi.fn(async (_session: unknown, ct: string) => {
    if (ct === "OLD_CIPHERTEXT") return "old plaintext from history";
    return "current plaintext";
  }),
  encryptPlaceBytes: vi.fn(),
  decryptPlaceBytes: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  randomPath: vi.fn(() => "rand"),
  toB64: vi.fn(),
  fromB64: vi.fn(),
}));

vi.mock("@/lib/markdown", () => ({
  renderMarkdown: (s: string) => s,
}));

vi.mock("@/components/rich-editor", () => {
  const React = require("react");
  const { useImperativeHandle } = React;
  return {
    RichEditor: React.forwardRef(function MockRichEditor(
      {
        initialContent,
        onMarkdownChange,
      }: {
        initialContent: string;
        onMarkdownChange: (s: string) => void;
      },
      ref: React.Ref<{
        getMarkdown: () => string;
        setMarkdown: (s: string) => void;
      }>,
    ) {
      const [value, setValue] = React.useState(initialContent);
      useImperativeHandle(ref, () => ({
        getMarkdown: () => value,
        setMarkdown: (s: string) => {
          setValue(s);
          onMarkdownChange(s);
        },
        focus: () => {},
        countFindMatches: (q: string) => {
          if (!q) return 0;
          const lower = value.toLowerCase();
          const hay = q.toLowerCase();
          let count = 0;
          let i = lower.indexOf(hay);
          while (i !== -1) {
            count += 1;
            i = lower.indexOf(hay, i + Math.max(1, hay.length));
          }
          return count;
        },
        findMatchAt: () => false,
        replaceMatchAt: () => false,
        replaceAllMatches: (_q: string, r: string) => {
          setValue(r);
          onMarkdownChange(r);
        },
        scrollToHeading: () => {},
        insertImageFromFile: async () => {},
      }));
      return null;
    }),
  };
});

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...(rest as object)}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Editor } from "@/components/editor";
import { savePage } from "@/lib/pages";
import { toast } from "sonner";
import { migrateLegacyMarkdown, parseWorkbook } from "@/lib/workbook";

const legacyCrypto = { kind: "legacy" as const, cryptoKey: {} as CryptoKey };

beforeEach(() => {
  appendCalls.length = 0;
  vi.mocked(savePage).mockClear();
  vi.mocked(toast.success).mockClear();
  let n = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    },
  });
});

describeVersioning("Editor — restoreVersion is strictly append-only", () => {
  it("appends a new encrypted snapshot when restoring from history and never updates the previous one", async () => {
    const workbook = migrateLegacyMarkdown("current plaintext");
    render(
      <Editor
        slug="travel-plans"
        initialWorkbook={workbook}
        initialActiveSheetId={workbook.primary_sheet_id}
        initialUpdatedAt={new Date().toISOString()}
        crypto={legacyCrypto}
        burnMode="never"
        expiresAt={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /history/i }));

    const versionBtn = await screen.findByRole("button", { name: /version 1/i });
    await act(async () => {
      fireEvent.click(versionBtn);
    });

    const restoreBtn = await screen.findByRole("button", { name: /restore this version/i });
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    await waitFor(() => {
      expect(savePage).toHaveBeenCalledTimes(1);
    });

    const restored = parseWorkbook("old plaintext from history");
    const expectedMarkdown = restored.sheets[0].markdown;

    expect(appendCalls).toHaveLength(1);
    expect(appendCalls[0]).toMatchObject({
      slug: "travel-plans",
      iv: "IV",
      ksp: false,
    });
    expect(appendCalls[0].ciphertext).toContain(expectedMarkdown);
    expect(appendCalls[0].ciphertext).toMatch(/^CT\(\{/);

    expect(JSON.stringify(appendCalls[0])).not.toContain("v-old");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/Restored to version 1/i),
      );
    });
  });

  it("appends even when the restored text matches the latest saved text (force=true)", async () => {
    const workbook = migrateLegacyMarkdown("old plaintext from history");
    render(
      <Editor
        slug="notes"
        initialWorkbook={workbook}
        initialActiveSheetId={workbook.primary_sheet_id}
        initialUpdatedAt={new Date().toISOString()}
        crypto={legacyCrypto}
        burnMode="never"
        expiresAt={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    const versionBtn = await screen.findByRole("button", { name: /version 1/i });
    await act(async () => {
      fireEvent.click(versionBtn);
    });
    const restoreBtn = await screen.findByRole("button", { name: /restore this version/i });
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    await waitFor(() => {
      expect(savePage).toHaveBeenCalledTimes(1);
    });
  });
});
