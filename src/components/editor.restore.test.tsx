import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// --- Mocks ---------------------------------------------------------------
// Capture every call made against the pages API so we can assert the editor
// only ever *appends* version snapshots and never tries to mutate one.
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

// Deterministic, fast "crypto" that lets us assert against produced ciphertext.
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

// --- Test ----------------------------------------------------------------
import { Editor } from "@/components/editor";
import { appendVersion } from "@/lib/pages";
import { toast } from "sonner";

const fakeKey = {} as CryptoKey;

beforeEach(() => {
  appendCalls.length = 0;
  vi.mocked(appendVersion).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("Editor — restoreVersion is strictly append-only", () => {
  it("appends a new encrypted snapshot when restoring from history and never updates the previous one", async () => {
    render(
      <Editor
        slug="travel-plans"
        initialText="current plaintext"
        initialUpdatedAt={new Date().toISOString()}
        cryptoKey={fakeKey}
        editToken="edit-token-123"
        burnMode="never"
        expiresAt={null}
      />,
    );

    // Open the version history modal
    fireEvent.click(screen.getByRole("button", { name: /history/i }));

    // Wait for the listed version to appear, then preview it
    const versionBtn = await screen.findByRole("button", { name: /version 1/i });
    await act(async () => {
      fireEvent.click(versionBtn);
    });

    // Click "Restore this version"
    const restoreBtn = await screen.findByRole("button", { name: /restore this version/i });
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    // appendVersion must have been called exactly once with the restored content
    await waitFor(() => {
      expect(appendVersion).toHaveBeenCalledTimes(1);
    });

    expect(appendCalls).toHaveLength(1);
    expect(appendCalls[0]).toMatchObject({
      slug: "travel-plans",
      edit_token: "edit-token-123",
      ciphertext: "CT(old plaintext from history)",
      iv: "IV",
    });

    // Confirms the version row identifier was never echoed back as an "update"
    // target — restoreVersion has no notion of editing an existing snapshot.
    expect(JSON.stringify(appendCalls[0])).not.toContain("v-old");

    // Friendly toast tells the user which version was restored
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/Restored to version 1/i),
      );
    });
  });

  it("appends even when the restored text matches the latest saved text (force=true)", async () => {
    // initialText is the same as what version-1 decrypts to in this test.
    render(
      <Editor
        slug="notes"
        initialText="old plaintext from history"
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

    // Even though content is unchanged, the editor still appends a new snapshot
    // — restore must NEVER be a no-op that could be confused with an in-place edit.
    await waitFor(() => {
      expect(appendVersion).toHaveBeenCalledTimes(1);
    });
  });
});
