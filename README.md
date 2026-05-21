# Doomscroll

Swipe-to-learn spaced repetition for codebases.

Doomscroll is a React Native product experiment for turning codebase exploration into short, reviewable cards. The premise is simple: developers already skim, save, and revisit fragments of code. This app makes that behavior explicit and structured.

## Why it exists

Codebase onboarding is usually too heavy for the moments when people actually learn: between tasks, during review, or while trying to understand a new system. Doomscroll explores a lighter interaction model for building familiarity with files, concepts, and implementation patterns over time.

## What it demonstrates

- Expo and React Native app structure with `expo-router`.
- Gesture-first mobile interaction patterns.
- Local-first product thinking for imported learning material.
- App Store oriented metadata and release preparation.
- A clear product thesis rather than a generic demo shell.

## Tech stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- Reanimated, Gesture Handler, SVG, AsyncStorage

## Run locally

```bash
npm install
npm run ios
```

For web preview:

```bash
npm run web
```

## Case study

See [CASE_STUDY.md](./CASE_STUDY.md) for the product framing, tradeoffs, and next steps.
