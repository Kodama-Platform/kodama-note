import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { hasKodamaAccountSession } from "@/lib/kodama-account-session";
import { fetchPayAccountMe, startPayCheckout } from "@/lib/kodama-pay";
import {
  defaultNoteEntitlement,
  defaultNotePaymentPublic,
  type NotePlaceEntitlement,
  type NotePlacePaymentOwner,
  type NotePlacePaymentPublic,
} from "@/lib/note-payment";
import { getPlanTier, type PlanTier } from "@/lib/plan-tier";
import {
  getPlaceEntitlement,
  getPlacePayment,
  paymentOwnerFromPublic,
  putPlacePayment,
} from "@/lib/place-public-api";
import { isPlaintextMode } from "@/lib/plaintext-mode";

export function usePlaceBilling(args: {
  slug: string;
  crypto: PlaceCryptoSession;
  canPersist: boolean;
  initialPayment?: NotePlacePaymentPublic | null;
  initialEntitlement?: NotePlaceEntitlement | null;
}) {
  const { slug, crypto, canPersist, initialPayment, initialEntitlement } = args;
  const [payment, setPayment] = useState<NotePlacePaymentPublic>(
    () => initialPayment ?? defaultNotePaymentPublic(slug),
  );
  const [entitlement, setEntitlement] = useState<NotePlaceEntitlement>(
    () => initialEntitlement ?? defaultNoteEntitlement(slug),
  );
  const [saving, setSaving] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    if (initialPayment) setPayment(initialPayment);
    if (initialEntitlement) setEntitlement(initialEntitlement);
  }, [initialPayment, initialEntitlement]);

  useEffect(() => {
    if (isPlaintextMode()) return;
    if (initialPayment && initialEntitlement) return;
    let cancelled = false;
    void Promise.all([
      initialPayment ? Promise.resolve(initialPayment) : getPlacePayment(slug),
      initialEntitlement ? Promise.resolve(initialEntitlement) : getPlaceEntitlement(slug),
    ])
      .then(([nextPayment, nextEntitlement]) => {
        if (cancelled) return;
        setPayment(nextPayment);
        setEntitlement(nextEntitlement);
      })
      .catch(() => {
        /* keep defaults when the gate is down */
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initialPayment, initialEntitlement]);

  const savePayment = useCallback(
    async (patch: Partial<NotePlacePaymentOwner>) => {
      if (!canPersist || crypto.kind !== "knp" || crypto.session.role !== "owner") {
        toast.error("Only the owner can change payment settings");
        return;
      }
      if (!hasKodamaAccountSession()) {
        toast.error("Sign in to a Kodama account to change payment settings");
        return;
      }
      setSaving(true);
      try {
        const next = await putPlacePayment({
          slug,
          payment: paymentOwnerFromPublic(payment, patch),
          session: crypto.session,
        });
        setPayment(next);
        const refreshed = await getPlaceEntitlement(slug);
        setEntitlement(refreshed);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save payment settings");
      } finally {
        setSaving(false);
      }
    },
    [canPersist, crypto, payment, slug],
  );

  const startUnlockCheckout = useCallback(async () => {
    setCheckoutBusy(true);
    try {
      const account = await fetchPayAccountMe();
      const result = await startPayCheckout({
        account_id: account?.account_id,
        product: "note",
        place_slug: slug,
      });
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      toast.error("Checkout did not return a URL");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout");
    } finally {
      setCheckoutBusy(false);
    }
  }, [slug]);

  const planTier: PlanTier = getPlanTier(entitlement);

  return {
    payment,
    entitlement,
    planTier,
    saving,
    checkoutBusy,
    savePayment,
    startUnlockCheckout,
  };
}
