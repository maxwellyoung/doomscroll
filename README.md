# Doomscroll

A small app for learning your way around a codebase. Import a GitHub repo, read short code cards, try explaining them, and mark what needs another look.

## Try it

```sh
npm ci
npm run web
```

Enter `owner/repo`, `owner/repo#src`, or a GitHub tree URL such as `https://github.com/owner/repo/tree/main/src`. Public repositories work without a token. The demo works without GitHub. First launch shows a code preview and a direct demo button.

Each imported card has a **view source** link to its exact commit and line range. The importer resolves the branch once before reading the tree and files, so the deck cannot accidentally combine two revisions. Selected files are read by their immutable blob identities from that tree, and returned identities must match. Imports stop if GitHub returns an incomplete tree, a mismatched file, unreadable UTF-8, or a selected file cannot be read.

Use the buttons or swipe: **again**, **skip**, or **got it**. Three consecutive “got it” ratings complete a card’s review. This is self-assessment, not a test of understanding. The queue prioritizes unseen cards and then least recently reviewed cards; it does not schedule spaced review intervals.

## Returning to a repo

Progress is saved on this device. The five most recent decks are retained locally so the feed can reload without sending source code through route URLs or browser history. Privacy settings can clear saved decks, progress, activity, repository history, and stored GitHub access. Reopening a recent repo fetches it again. Unchanged cards keep their progress even if their order or the repository commit changes. A change to a card's code, prompt, or explanation resets that card. Removed cards do not count toward completion.

Older progress records without source fingerprints reset once rather than risk crediting the wrong code. Reopening GitHub repos requires a connection; offline cached repo sessions are not implemented.

## Local decks

```sh
npm run deck:export-local -- /path/to/repo --scope src
```

The app can import the resulting JSON deck. Portable cards retain source links when supplied; local exports do not imply a verified GitHub revision. Imported decks use the same content checks before restoring progress.

## Scope and limits

- React Native / Expo, with a browser entry point for trying the interaction.
- Heuristic extraction for TypeScript/JavaScript, Python, Rust, Go, and Swift. This is not an AST parser; some constructs will be missed or extracted imperfectly.
- Reads up to 40 selected code files and creates up to 50 cards per GitHub import. Larger files and generated/build/test paths are filtered out.
- Prompts come from code structure; explanations use available source comments or a reading prompt. No AI-generated claims about what the code does.
- Prototype. Physical-device usability and whether this improves another person's learning have not been established by the automated checks.
- Optional GitHub tokens use the native OS credential vault, with verified migration from legacy AsyncStorage. Browser tokens stay in memory until reload; older browser tokens are discarded. A vault failure never falls back to plaintext or silently sends an unauthenticated import; unlock and retry secure access in GitHub settings. Settings refresh when the app returns to the foreground. Native vault behavior and migration still need device verification before release.

## Check it

```sh
npm test
npm run typecheck
```

The tests cover commit-pinned imports, missing source, stable card identity, changed-source resets, queue behavior, and portable-deck validation. CI runs these checks on pull requests.
