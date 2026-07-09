import { describe, expect, it } from "vitest";

import { assertNoSecretsInPayload } from "@/lib/server-payload";

describe("assertNoSecretsInPayload", () => {
  it("allows encrypted page write payloads", () => {
    expect(() =>
      assertNoSecretsInPayload(
        {
          p_slug: "notes",
          p_ciphertext: "YWJj",
          p_salt: "c2FsdA==",
          p_iv: "aXY=",
          p_kdf_params: { algo: "argon2id", m: 65536, t: 3, p: 1, version: 19 },
          p_edit_token: "server-capability-token",
        },
        "kodama_create_page",
      ),
    ).not.toThrow();
  });

  it("rejects password fields", () => {
    expect(() =>
      assertNoSecretsInPayload({ p_slug: "notes", p_password: "hunter2" }, "kodama_create_page"),
    ).toThrow(/password/i);
  });

  it("rejects plaintext fields", () => {
    expect(() =>
      assertNoSecretsInPayload({ p_slug: "notes", plaintext: "hello" }, "kodama_append_version"),
    ).toThrow(/plaintext/i);
  });

  it("rejects nested secret fields", () => {
    expect(() =>
      assertNoSecretsInPayload(
        { p_kdf_params: { password: "oops" } },
        "kodama_create_page",
      ),
    ).toThrow(/password/i);
  });
});
