import assert from "node:assert/strict";
import { test } from "node:test";
import { createTokenVault } from "../lib/token-storage";

function fixture() {
  const state = { secure: null as string | null, legacy: " legacy-token " as string | null, writesFail: false };
  const vault = createTokenVault({
    readSecure: async () => state.secure,
    writeSecure: async value => { if (state.writesFail) throw new Error("Vault unavailable"); state.secure = value; },
    removeSecure: async () => { state.secure = null; },
    readLegacy: async () => state.legacy,
    removeLegacy: async () => { state.legacy = null; },
  });
  return { state, vault };
}

test("legacy token migrates to vault before plaintext copy is removed", async () => {
  const { state, vault } = fixture();
  assert.equal(await vault.get(), "legacy-token");
  assert.equal(state.secure, "legacy-token");
  assert.equal(state.legacy, null);
});

test("failed vault migration preserves original but never returns plaintext", async () => {
  const { state, vault } = fixture(); state.writesFail = true;
  await assert.rejects(vault.get(), /Vault unavailable/);
  assert.equal(state.legacy, " legacy-token ");
  state.writesFail = false;
  assert.equal(await vault.get(), "legacy-token");
});

test("removal queued during migration cannot resurrect token", async () => {
  const { state, vault } = fixture();
  const read = vault.get(); const clear = vault.clear();
  await read; await clear;
  assert.equal(await vault.get(), null);
  assert.equal(state.secure, null); assert.equal(state.legacy, null);
});

test("new token replaces stale legacy and blank input preserves existing access", async () => {
  const { state, vault } = fixture();
  await vault.save(" new-token ");
  assert.equal(await vault.get(), "new-token");
  await assert.rejects(vault.save(" "), /Enter a GitHub token/);
  assert.equal(state.secure, "new-token"); assert.equal(state.legacy, null);
});


test("a new vault instance after restart reads secured access without remigrating plaintext", async () => {
  const { state, vault } = fixture();
  await vault.save("synthetic-restart-token");
  let secureWrites = 0;
  const restarted = createTokenVault({
    readSecure: async () => state.secure,
    writeSecure: async value => { secureWrites++; state.secure = value; },
    removeSecure: async () => { state.secure = null; },
    readLegacy: async () => state.legacy,
    removeLegacy: async () => { state.legacy = null; },
  });
  assert.equal(await restarted.get(), "synthetic-restart-token");
  assert.equal(secureWrites, 0);
  await restarted.clear();
  assert.equal(await vault.get(), null);
});

test("unavailable secure reads never return a legacy value and recover after unlocking", async () => {
  let locked = true;
  let secure: string | null = null;
  const vault = createTokenVault({
    readSecure: async () => { if (locked) throw new Error("Synthetic locked vault"); return secure; },
    writeSecure: async value => { secure = value; }, removeSecure: async () => { secure = null; },
    readLegacy: async () => "synthetic-legacy", removeLegacy: async () => {},
  });
  await assert.rejects(vault.get(), /locked vault/);
  locked = false;
  assert.equal(await vault.get(), "synthetic-legacy");
});

test("a mismatched secure write confirmation retains the only legacy copy", async () => {
  let legacy: string | null = "synthetic-legacy";
  const vault = createTokenVault({
    readSecure: async () => null, writeSecure: async () => {}, removeSecure: async () => {},
    readLegacy: async () => legacy, removeLegacy: async () => { legacy = null; },
  });
  await assert.rejects(vault.get(), /Could not secure/);
  assert.equal(legacy, "synthetic-legacy");
});
