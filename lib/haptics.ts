/**
 * Haptic feedback — Marc Rousavy precision.
 * Every touch has a consequence you can feel.
 */
import * as Haptics from "expo-haptics";

export const haptic = {
  /** Light tick — crossing a threshold */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Medium thud — committing an action */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Heavy — rare, only for mastery or destruction */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  /** Success — card mastered */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Selection tick — scrubbing through options */
  tick: () => Haptics.selectionAsync(),
} as const;
