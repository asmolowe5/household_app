export const APP_NAME = "Smolowe Portal";

export const PACE_THRESHOLDS = {
  /** Spending rate / budget rate ratio thresholds */
  GREEN_MAX: 1.2,    // up to 20% ahead of pace = green
  YELLOW_MAX: 1.5,   // 20-50% ahead of pace = yellow
  ORANGE_MAX: Infinity, // 50%+ ahead = orange (SMS alert)
  // Budget exceeded = red (SMS alert) — checked separately
} as const;

export const ALERT_LIMITS = {
  MAX_PER_CATEGORY_PER_DAY: 1,
  MAX_PER_PERSON_PER_DAY: 5,
} as const;

export type PaceStatus = "green" | "yellow" | "orange" | "red";
