import assert from "node:assert/strict";
import { test } from "node:test";
import { saveDeckSession, loadDeckSession, clearDeckSessions } from "../lib/deck-session";
import { mockCards } from "../lib/mock-data";
function fixture() {
  const values = new Map<string, string>();
  return { values, storage: { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); } } };
}
const session = { cards: mockCards, repoName: "demo/typescript-patterns", repoDesc: "Public demo", repoStars: "0" };

test("route key contains no source; saved deck survives reload without a network request", async () => {
  const { storage } = fixture();
  const id = await saveDeckSession(session, storage);
  assert.match(id, /^[a-z0-9-]+$/);
  assert.ok(!id.includes(session.repoName));
  assert.deepEqual(await loadDeckSession(id, storage), session);
});

test("five recent decks retained; old links fail honestly and privacy removal clears code", async () => {
  const { storage, values } = fixture(); const ids: string[] = [];
  for (let i = 0; i < 6; i++) ids.push(await saveDeckSession(session, storage));
  assert.equal(await loadDeckSession(ids[0], storage), null);
  assert.deepEqual(await loadDeckSession(ids[5], storage), session);
  await clearDeckSessions(storage); assert.equal(values.size, 0);
});

test("invalid session keys or malformed stored cards cannot open a feed", async () => {
  const { storage } = fixture();
  assert.equal(await loadDeckSession("../../secret", storage), null);
  const id = await saveDeckSession(session, storage);
  await storage.setItem(`doomscroll:deck-session:${id}`, JSON.stringify({ ...session, cards: [{ type: "bogus" }] }));
  assert.equal(await loadDeckSession(id, storage), null);
});
