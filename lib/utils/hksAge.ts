import type { Member } from '@/lib/types';

// Official HKF (Hrvatska karate federacija) age categories
// Aligned with WKF Senior/Junior/Cadet/U14 rules as applied in Croatian competitions.
// Source: HKF Pravilnik o natjecanjima + WKF Technical Commission age rules.
export type HksCategory = Member['category'];

export const HKS_CAT_LABEL: Record<HksCategory, string> = {
  mali_karatist: 'Mali karatist (< 14)',
  kadet:         'Kadet (14–15)',
  junior:        'Junior (16–17)',
  senior:        'Senior (18–34)',
  veteran:       'Veteran (35+)',
};

/**
 * Computes the correct HKF category for a member based on their exact age today.
 * Returns null when birthDate is missing or invalid — caller keeps existing category.
 *
 * Age boundaries (inclusive lower, exclusive upper):
 *   < 14          → mali_karatist
 *   14 – 15       → kadet
 *   16 – 17       → junior
 *   18 – 34       → senior   (includes "Mlađi seniori" 18–20, not separate in DB)
 *   35+           → veteran
 */
export function computeHksCategory(birthDateStr: string | null | undefined): HksCategory | null {
  if (!birthDateStr) return null;

  // Parse ISO date components directly — avoids new Date("YYYY-MM-DD") being
  // treated as UTC midnight which shifts the date in non-UTC timezones.
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1; // getMonth() is 0-indexed
  const todayD = today.getDate();

  let age = todayY - y;
  const mDiff = todayM - m;
  if (mDiff < 0 || (mDiff === 0 && todayD < d)) age--;

  if (age < 0)  return null;        // future date — skip
  if (age < 14) return 'mali_karatist';
  if (age < 16) return 'kadet';
  if (age < 18) return 'junior';
  if (age < 35) return 'senior';
  return 'veteran';
}

/**
 * Checks whether a member's stored category matches what HKF rules dictate today.
 * Returns the correct category if different, null if already correct or undecidable.
 */
export function needsRecategorization(
  currentCat: HksCategory,
  birthDateStr: string | null | undefined,
): HksCategory | null {
  const correct = computeHksCategory(birthDateStr);
  if (!correct || correct === currentCat) return null;
  return correct;
}
