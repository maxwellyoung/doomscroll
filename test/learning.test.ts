import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ingestRepo } from '../lib/ingest';
import { generateCards } from '../lib/generate';
import { extractBlocks, rankBlocks } from '../lib/extract';
import { cardFingerprint, reconcileProgress, sourceUrl } from '../lib/progress';
import { buildQueue } from '../lib/repetition';
import { parsePortableDeck } from '../lib/portable-deck';
import { fetchFiles } from '../lib/github';

const commit = 'a'.repeat(40);
const blob = 'b'.repeat(40);
const source = '/** Doubles a number. */\nexport function double(value: number) {\n  return value * 2;\n}\n';
function cardsFor(content = source) {
  return generateCards(extractBlocks({ path: 'src/math.ts', content }), 50, { repo: 'example/learning', commit });
}
function saved(card: ReturnType<typeof cardsFor>[number]) {
  return { cardId: card.id, seen: 3, mastered: true, lastSeen: 10, fingerprint: cardFingerprint(card) };
}

test('selected branch resolves once; tree, content, and source link use that commit', async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input); urls.push(url);
    if (url.endsWith('/repos/example/learning')) return Response.json({ name: 'learning', full_name: 'example/learning', default_branch: 'main' });
    if (url.endsWith('/commits/feature')) return Response.json({ sha: commit });
    if (url.endsWith(`/git/trees/${commit}?recursive=1`)) return Response.json({ tree: [{ path: 'src/math.ts', type: 'blob', sha: blob, size: 120 }] });
    if (url.endsWith(`/git/blobs/${blob}`)) return Response.json({ sha: blob, encoding: 'base64', content: Buffer.from(source).toString('base64') });
    throw new Error(`Unexpected request ${url}`);
  });
  const result = await ingestRepo('https://github.com/example/learning/tree/feature/src', () => {});
  assert.equal(urls.length, 4);
  assert.equal(result.cards[0].code, source.split('\n').slice(1, 4).join('\n'));
  assert.equal(sourceUrl(result.cards[0]), `https://github.com/example/learning/blob/${commit}/src/math.ts#L2-L4`);
});

test('incomplete trees and unreadable files stop an import instead of silently dropping code', async (t) => {
  let truncated = true;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/repos/example/learning')) return Response.json({ full_name: 'example/learning', default_branch: 'main' });
    if (url.includes('/commits/')) return Response.json({ sha: commit });
    if (url.includes('/git/trees/')) return Response.json({ truncated, tree: [{ path: 'src/math.ts', type: 'blob', sha: blob }] });
    return Response.json({ message: 'API rate limit exceeded' }, { status: 403 });
  });
  await assert.rejects(ingestRepo('example/learning', () => {}), /incomplete file tree/);
  truncated = false;
  await assert.rejects(ingestRepo('example/learning', () => {}), /Could not read src\/math.ts.*rate limit/);
});

test('same-named functions in different files remain separate and card IDs survive reranking', () => {
  const a = extractBlocks({ path: 'a.ts', content: source });
  const b = extractBlocks({ path: 'b.ts', content: source });
  assert.equal(rankBlocks([...a, ...b]).length, 2);
  assert.equal(generateCards([...a, ...b])[0].id, generateCards([...b, ...a])[1].id);
});

test('unchanged cards retain progress across commits; edited code or explanation resets it', () => {
  const [card] = cardsFor();
  const progress = { [card.id]: saved(card), removed: { ...saved(card), cardId: 'removed' } };
  const next = { ...card, source: { ...card.source!, commit: 'b'.repeat(40) } };
  assert.equal(Object.keys(reconcileProgress([next], progress)).length, 1);
  assert.equal(reconcileProgress([next], progress)[card.id].mastered, true);
  assert.deepEqual(reconcileProgress(cardsFor(source.replace('* 2', '* 3')), progress), {});
  assert.deepEqual(reconcileProgress([{ ...card, explanation: 'A new explanation' }], progress), {});
  assert.deepEqual(reconcileProgress([card], { [card.id]: { ...saved(card), fingerprint: undefined } }), {});
});

test('invalid stored progress is discarded; removed mastery cannot finish a new deck', () => {
  const [card] = cardsFor();
  for (const value of [null, [], 'oops', { [card.id]: { ...saved(card), seen: -1 } }]) {
    assert.deepEqual(reconcileProgress([card], value), {});
  }
  assert.deepEqual(reconcileProgress([card], { removed: saved(card) }), {});
});

test('a one-card deck never disappears after a rating; skipped unseen cards move back', () => {
  const [card] = cardsFor();
  assert.deepEqual(buildQueue([card], { [card.id]: { ...saved(card), seen: 1, mastered: false } }, card.id), [card]);
  const second = { ...card, id: 'second' };
  assert.deepEqual(buildQueue([card, second], {}, card.id), [second, card]);
});

test('portable decks preserve source links, reject invalid types and duplicate IDs', () => {
  const deck = { version: 1, meta: { repoName: 'example/learning' }, cards: cardsFor() };
  assert.equal(sourceUrl(parsePortableDeck(JSON.stringify(deck)).cards[0]), sourceUrl(deck.cards[0]));
  assert.throws(() => parsePortableDeck(JSON.stringify({ ...deck, cards: [deck.cards[0], deck.cards[0]] })), /invalid card/);
  assert.throws(() => parsePortableDeck(JSON.stringify({ ...deck, cards: [{ ...deck.cards[0], type: 'bogus' }] })), /invalid card/);
  assert.equal(sourceUrl({ ...deck.cards[0], source: { ...deck.cards[0].source!, repo: 'evil.example/foo/bar' } }), undefined);
});


test('a missing tree identity or mismatched blob cannot become a source-linked deck', async (t) => {
  let treeHasSha = false;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/repos/example/learning')) return Response.json({ full_name: 'example/learning', default_branch: 'main' });
    if (url.includes('/commits/')) return Response.json({ sha: commit });
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ path: 'src/math.ts', type: 'blob', ...(treeHasSha ? { sha: blob } : {}) }] });
    if (url.endsWith(`/git/blobs/${blob}`)) return Response.json({ sha: 'c'.repeat(40), encoding: 'base64', content: Buffer.from(source).toString('base64') });
    throw new Error('Unexpected source request');
  });
  await assert.rejects(ingestRepo('example/learning', () => {}), /valid source identity/);
  treeHasSha = true;
  await assert.rejects(ingestRepo('example/learning', () => {}), /different source file than the pinned tree/);
});


test('immutable file decoding preserves Unicode and rejects oversized or non-UTF8 source', async (t) => {
  let bytes = Buffer.from('export const greeting = "Kia ora — 🌱";');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ sha: blob, encoding: 'base64', content: bytes.toString('base64') }));
  const selected = [{ path: 'src/unicode.ts', type: 'blob' as const, sha: blob }];
  assert.equal((await fetchFiles('example', 'learning', selected))[0].content, bytes.toString('utf8'));
  bytes = Buffer.from([0xc0, 0xaf]);
  await assert.rejects(fetchFiles('example', 'learning', selected), /Could not read/);
  bytes = Buffer.alloc(50_001, 65);
  await assert.rejects(fetchFiles('example', 'learning', selected), /size limit/);
});
