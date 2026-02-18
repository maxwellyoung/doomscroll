# doomscroll

Master any codebase by doomscrolling through it. Swipe-to-learn spaced repetition for code.

## Design Philosophy

### Visual & Interaction
- **Emil Kowalski** — Motion grammar. Springs are sentences, not decorations.
- **Jordan Singer** — Product poetry. Every pixel is intentional.
- **Mariana Castilho** — Fluid interfaces. Cards are not rigid.
- **Muriel Cooper** — Pre-internet interface metaphysics. Code floats in dark space.
- **Susan Kare** — Symbolic micro-iconography. One glyph, one color, one type.
- **Christopher Alexander** — Pattern language. Cards are centers. The stack has life.
- **Dieter Rams** — Moral baseline. Every element earns its place.

### Engineering
- **Dan Abramov** — Self-critiquing clarity. One hook, one mental model.
- **Marc Rousavy** — Native precision. Haptics on every threshold crossing.
- **Evan Bacon** — Expo playfulness. File-based routing, zero ceremony.
- **Georgi Gerganov** — Local-AI efficiency. Small footprint, fast startup.
- **Sindre Sorhus** — Severe minimalism. Less code = more correct.
- **Rich Harris** — Anti-dogma. No ceremony. The app is a deck of cards.

## Stack
- Expo SDK 54 + Expo Router 6
- React Native Reanimated 4 + Gesture Handler 2
- expo-haptics, expo-linear-gradient
- TypeScript strict mode

## Commands
```bash
npm start         # Expo dev server
npm run ios       # iOS simulator
npm run android   # Android emulator
```

## Architecture
```
app/
  _layout.tsx         — Root (gesture handler, dark theme, status bar)
  index.tsx           — The feed (the entire experience)
components/
  SwipeCard.tsx       — Fluid swipe card with gesture physics
  CardStack.tsx       — Visible depth (peek-behind next card)
  Header.tsx          — Title, stats, full-width progress bar
lib/
  design.ts           — Design system (color, type, spacing, motion springs)
  store.ts            — useCardDeck hook (swipe state, spaced repetition)
  haptics.ts          — Haptic feedback utilities
  mock-data.ts        — Seed cards (TypeScript patterns)
types/
  index.ts            — CodeCard, CardProgress, RepoSession
```

## Swipe Mechanics
- **Right** = "Got it" — mastered after 3 correct swipes
- **Left** = "Again" — resets mastery, resurfaces
- **Up** = Skip

## Design Tokens
- Dark: #050505 base (warm, alive — not pure black)
- Springs: responsive/gentle/silk/bouncy/heavy (named, composable)
- Card types: fn=blue, type=purple, idea=amber, pattern=green, file=cyan
- Haptics: light at threshold, medium on commit, success on mastery
