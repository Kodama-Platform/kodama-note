import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const appendCalls: Array<{
  slug: string;
  edit_token: string;
  ciphertext: string;
  iv: string;
}> = [];

vi.mock("@/lib/pages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pages")>();
  return {
    ...actual,
    appendVersion: vi.fn(async (args: {
      slug: string;
      edit_token: string;
      ciphertext: string;
      iv: string;
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

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn(async (_key: unknown, plaintext: string) => ({
    ciphertext: `CT(${plaintext})`,
    iv: "IV",
  })),
  decrypt: vi.fn(async (_key: unknown, ct: string) => {
    if (ct === "OLD_CIPHERTEXT") return "old plaintext from history";
    return "current plaintext";
  }),
  encryptBytes: vi.fn(),
  decryptBytes: vi.fn(),
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
        findInDocument: () => false,
        replaceInMarkdown: () => null,
        replaceAllInMarkdown: (_q: string, r: string) => value.replace(/./g, r),
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
import { appendVersion } from "@/lib/pages";
import { toast } from "sonner";
import { migrateLegacyMarkdown, parseWorkbook } from "@/lib/workbook";

const fakeKey = {} as CryptoKey;

beforeEach(() => {
  appendCalls.length = 0;
  vi.mocked(appendVersion).mockClear();
  vi.mocked(toast.success).mockClear();
  let n = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    },
  });
});

describe("Editor — restoreVersion is strictly append-only", () => {
  it("appends a new encrypted snapshot when restoring from history and never updates the previous one", async () => {
    const workbook = migrateLegacyMarkdown("current plaintext");
    render(
      <Editor
        slug="travel-plans"
        initialWorkbook={workbook}
        initialActiveSheetId={workbook.primary_sheet_id}
        initialUpdatedAt={new Date().toISOString()}
        cryptoKey={fakeKey}
        editToken="edit-token-123"
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
      expect(appendVersion).toHaveBeenCalledTimes(1);
    });

    const restored = parseWorkbook("old plaintext from history");
    const expectedMarkdown = restored.sheets[0].markdown;

    expect(appendCalls).toHaveLength(1);
    expect(appendCalls[0]).toMatchObject({
      slug: "travel-plans",
      edit_token: "edit-token-123",
      iv: "IV",
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
        cryptoKey={fakeKey}
        editToken="edit-token-xyz"
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
      expect(appendVersion).toHaveBeenCalledTimes(1);
    });
  });
});
