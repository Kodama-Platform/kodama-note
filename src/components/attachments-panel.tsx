import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadEncryptedAttachment } from "@/lib/attachment-upload";
import { decrypt, decryptBytes } from "@/lib/crypto";
import { downloadAttachmentBlob, listAttachments, type AttachmentRow } from "@/lib/pages";
import {
  formatAttachmentLimit,
  maxAttachmentsPerSheet,
  type PlanTier,
} from "@/lib/plan-tier";
import { collectSheetAttachmentRefs } from "@/lib/workbook";

type DecryptedAttachment = AttachmentRow & { filename: string };

export function AttachmentsPanel({
  slug,
  cryptoKey,
  editToken,
  sheetMarkdown,
  sheetAttachmentIds,
  planTier,
  onAttachmentAdded,
}: {
  slug: string;
  cryptoKey: CryptoKey;
  editToken: string | null;
  sheetMarkdown: string;
  sheetAttachmentIds: Set<string>;
  planTier: PlanTier;
  onAttachmentAdded: (id: string) => void;
}) {
  const [allItems, setAllItems] = useState<DecryptedAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const markdownRefs = useMemo(() => collectSheetAttachmentRefs(sheetMarkdown), [sheetMarkdown]);
  const limit = maxAttachmentsPerSheet(planTier);
  const atLimit = limit !== null && sheetAttachmentIds.size >= limit;

  const items = useMemo(
    () => allItems.filter((a) => sheetAttachmentIds.has(a.id.toLowerCase())),
    [allItems, sheetAttachmentIds],
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listAttachments(slug);
      const decrypted = await Promise.all(
        rows.map(async (r) => {
          try {
            const fn = await decrypt(cryptoKey, r.filename_ciphertext, r.filename_iv);
            return { ...r, filename: fn };
          } catch {
            return { ...r, filename: "(unreadable)" };
          }
        }),
      );
      setAllItems(decrypted);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const upload = async (file: File) => {
    if (!editToken) {
      toast.error("You need the edit link on this device to upload files");
      return;
    }
    if (atLimit) {
      toast.error(
        limit === 1
          ? "Free plan allows 1 attachment per sheet"
          : `Maximum ${formatAttachmentLimit(planTier)} attachments per sheet on your plan`,
      );
      return;
    }
    setUploading(true);
    try {
      const { id } = await uploadEncryptedAttachment({
        file,
        slug,
        editToken,
        cryptoKey,
      });
      onAttachmentAdded(id);
      toast.success("Attachment encrypted & uploaded");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const download = async (a: DecryptedAttachment) => {
    try {
      const blob = await downloadAttachmentBlob(a.storage_path);
      const ct = new Uint8Array(await blob.arrayBuffer());
      const pt = await decryptBytes(cryptoKey, ct, a.iv);
      const url = URL.createObjectURL(new Blob([pt.buffer as ArrayBuffer], { type: a.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = a.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const limitLabel = formatAttachmentLimit(planTier);

  return (
    <div className="rounded-2xl border border-border/80 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
          <span className="font-sans normal-case tracking-normal text-muted-foreground">
            ({items.length}
            {limit !== null ? `/${limitLabel}` : ""})
          </span>
        </div>
        {editToken && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,text/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading || atLimit}
              className="note-toolbar-btn !text-primary hover:!border-primary/40 hover:!bg-primary/10 disabled:opacity-50"
              title={atLimit ? `Plan limit: ${limitLabel} per sheet` : undefined}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Encrypting…" : "Add file"}
            </button>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments on this sheet yet.</p>
        ) : (
          items.map((a) => {
            const orphaned = !markdownRefs.has(a.id.toLowerCase());
            return (
              <button
                key={a.id}
                onClick={() => download(a)}
                className={`group flex w-full items-center gap-3 rounded-lg border px-2 py-1.5 text-left transition-colors hover:border-border/60 hover:bg-primary/5 ${
                  orphaned ? "border-amber-500/30 bg-amber-500/5" : "border-transparent"
                }`}
                title={orphaned ? "Not referenced in this sheet's notes" : undefined}
              >
                {a.mime.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm text-foreground">
                  {a.filename}
                  {orphaned && (
                    <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Unlinked
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
