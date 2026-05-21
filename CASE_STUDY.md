# Doomscroll Case Study

## Problem

Developers learn codebases in fragments, but most tools assume long, deliberate study sessions. The goal was to explore a mobile-native way to turn small moments into useful familiarity.

## Approach

Doomscroll treats codebase learning as a sequence of lightweight cards. The interaction model borrows from feeds, but the product goal is retention rather than passive consumption: quick review, repeated exposure, and enough structure to make unfamiliar code feel navigable.

## Engineering decisions

- Use Expo and React Native to keep the prototype close to a real mobile release path.
- Keep the app local-first where possible so imported material can be reviewed without a backend dependency.
- Build around gestures and haptics because the core interaction is repeated, fast, and mobile-specific.
- Maintain App Store metadata alongside the app to keep the prototype honest about distribution constraints.

## Tradeoffs

- A feed-like interface is familiar, but it can also imply low-intent consumption. The product needs strong review mechanics to avoid becoming novelty UI.
- Local-first storage reduces infrastructure work, but sharing and team use would require a sync model.
- Code understanding is contextual, so future versions should preserve source links, file hierarchy, and review history.

## Next steps

- Add import pipelines for GitHub repositories and local archives.
- Add recall prompts and spaced repetition scheduling.
- Track retention signals and review streaks without turning the app into a gamified distraction.
