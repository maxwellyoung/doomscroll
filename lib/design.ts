/**
 * Design system for doomscroll.
 *
 * Soft futurism (Kowalski) — warm darks, not harsh.
 * Moral baseline (Rams) — every value earns its place.
 * Pattern language (Alexander) — named, composable, alive.
 */

// ─── Color ───────────────────────────────────────────────
// Not pure black. Warm enough to feel alive.
// Not pure white. Calm enough to read code for hours.
export const color = {
  bg: "#050505",
  surface: "#0f0f0f",
  surfaceRaised: "#161616",
  surfaceHover: "#1c1c1c",
  border: "#222222",
  borderSubtle: "#1a1a1a",

  text: "#e8e8e8",
  textSecondary: "#7a7a7a",
  textTertiary: "#454545",
  textInverse: "#050505",

  // Muted accents — they whisper, not shout
  blue: "#6b9eff",
  green: "#5ce89b",
  amber: "#e8b95c",
  purple: "#b48eff",
  rose: "#ff7eb3",
  cyan: "#5ce8d6",

  // Semantic
  got: "#5ce89b",
  again: "#ff7070",
  skip: "#7a7a7a",
} as const;

// ─── Typography ──────────────────────────────────────────
// Limited scale. Each size has a purpose.
export const type = {
  mono: { fontFamily: "monospace" },
  size: {
    xs: { fontSize: 11, lineHeight: 16 },
    sm: { fontSize: 13, lineHeight: 18 },
    base: { fontSize: 15, lineHeight: 22 },
    lg: { fontSize: 18, lineHeight: 26 },
    xl: { fontSize: 24, lineHeight: 30 },
    xxl: { fontSize: 32, lineHeight: 38 },
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────
// 4px half-grid for tight spots. 8px base grid for everything else.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Radius ──────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ─── Motion ──────────────────────────────────────────────
// Emil Kowalski's grammar: springs are sentences.
// Every spring has a personality.
export const spring = {
  /** Immediate response, no play. Buttons, toggles. */
  responsive: { damping: 26, stiffness: 300, mass: 0.8 },
  /** Soft settle. Progress bars, layout shifts. */
  gentle: { damping: 24, stiffness: 120, mass: 1 },
  /** Premium feel. Cards moving, page transitions. */
  silk: { damping: 28, stiffness: 180, mass: 0.9 },
  /** Playful overshoot. Celebrations, arrivals. */
  bouncy: { damping: 12, stiffness: 200, mass: 0.8 },
  /** Heavy and deliberate. Modals, drawers. */
  heavy: { damping: 30, stiffness: 160, mass: 1.2 },
} as const;

// ─── Swipe physics ───────────────────────────────────────
export const swipe = {
  /** Distance before a swipe commits */
  threshold: 0.28, // % of screen width
  /** Vertical distance to trigger skip */
  upThreshold: -100,
  /** Card rotation at full swipe */
  maxRotation: 12,
  /** Velocity that auto-completes a swipe */
  velocityThreshold: 800,
} as const;

// ─── Card type taxonomy ──────────────────────────────────
// Susan Kare: each type gets one color, one symbol, one word.
export const cardTypes = {
  function: { color: color.blue, label: "fn", symbol: "ƒ" },
  type: { color: color.purple, label: "type", symbol: "τ" },
  concept: { color: color.amber, label: "idea", symbol: "◆" },
  pattern: { color: color.green, label: "pattern", symbol: "◇" },
  file: { color: color.cyan, label: "file", symbol: "□" },
} as const;

// ─── Difficulty ──────────────────────────────────────────
export const difficulty = {
  1: { label: "foundational", dots: 1 },
  2: { label: "intermediate", dots: 2 },
  3: { label: "advanced", dots: 3 },
} as const;
