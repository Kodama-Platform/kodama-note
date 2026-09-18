import { useState } from "react";

import { hasKodamaAccountSession } from "@/lib/kodama-account-session";
import type { NotePaymentAccess, NotePlacePaymentPublic } from "@/lib/note-payment";
import { formatAttachmentLimit, type PlanTier } from "@/lib/plan-tier";

const ACCESS: { value: NotePaymentAccess; label: string; hint: string }[] = [
  { value: "free", label: "Free", hint: "Anyone with the link can load this place" },
  { value: "paid", label: "Paid unlock", hint: "Kodama Pay must entitle the visitor first" },
  { value: "donation", label: "Donation", hint: "Free to read; show a donate target" },
];

export function PlacePaymentSettings({
  payment,
  planTier,
  saving,
  onSave,
}: {
  payment: NotePlacePaymentPublic;
  planTier: PlanTier;
  saving: boolean;
  onSave: (patch: {
    access?: NotePaymentAccess;
    donate?: { visible: boolean; destination?: string };
  }) => void;
}) {
  const [destination, setDestination] = useState(payment.donate.destination ?? "");
  const signedIn = hasKodamaAccountSession();

  return (
    <div className="space-y-2 px-2.5 py-1.5">
      <p className="text-[11px] text-muted-foreground">
        Plan · {planTier} · {formatAttachmentLimit(planTier)} attachments / sheet
      </p>
      {!signedIn && (
        <p className="text-[11px] text-muted-foreground">
          Connect a Kodama account to change how this slug is paid for.
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {ACCESS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={saving || !signedIn}
            title={opt.hint}
            onClick={() => onSave({ access: opt.value })}
            className={`rounded-md px-2 py-1 text-[11px] disabled:opacity-50 ${
              payment.access === opt.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-primary/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {payment.access === "donation" && (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              access: "donation",
              donate: { visible: true, destination: destination.trim() },
            });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-[10px] text-muted-foreground">Donate URL</span>
            <input
              type="url"
              value={destination}
              disabled={saving || !signedIn}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="https://…"
              className="note-input !h-8 !px-2 !text-[11px]"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !signedIn}
            className="note-toolbar-btn !h-7 !px-2 !text-[11px] disabled:opacity-50"
          >
            Save donate target
          </button>
        </form>
      )}
    </div>
  );
}
