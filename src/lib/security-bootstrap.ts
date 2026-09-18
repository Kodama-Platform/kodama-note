/**
 * Application bootstrap — only place that selects the SecurityProvider.
 * Product code and Note protocol never import security-browser / Tauri.
 */

import type { SecurityProvider } from "@kodama.page/core";
import { createBrowserSecurityProvider } from "@kodama.page/security-browser";

import { createNoteApiDeliveryClient } from "@/lib/note-delivery-client";
import { createNoteProtocol, type NoteProtocol } from "@/lib/note-protocol";

export type KodamaNoteApp = {
  readonly security: SecurityProvider;
  readonly note: NoteProtocol;
};

let app: KodamaNoteApp | null = null;

export function composeKodamaNoteApp(): KodamaNoteApp {
  if (app) return app;
  const security = createBrowserSecurityProvider();
  const delivery = createNoteApiDeliveryClient();
  const note = createNoteProtocol({ security, delivery });
  app = { security, note };
  return app;
}

/** Test helper — reset singleton between tests. */
export function resetKodamaNoteAppForTests(): void {
  app = null;
}
