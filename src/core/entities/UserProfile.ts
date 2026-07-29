export interface UserProfile {
  id?: string;
  name: string;
  gender: 'male' | 'female';
  birthDate: Date;
  height: number; // in cm
  targetWeight?: number; // in kg
  targetBodyFat?: number; // in %
  targetCalories?: number; // in kcal
  targetProtein?: number; // in g
  weeklyWorkoutGoalDays?: number; // default: 4 days/week
  createdAt: Date;
  trainingProfile?: string;
  availableEquipment?: string[]; // e.g. ["barbell","dumbbell","cable","body weight"]
}

/**
 * What counts as a height.
 *
 * Not cosmetic validation: `BiaCalculator` derives BMI, BMR, body fat and
 * metabolic age from this number, so a stray digit silently skews every body
 * metric in the app rather than failing visibly. Onboarding and the profile
 * editor both check it, and they check the same thing because it lives here.
 */
export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 230;

/** Accepts a decimal comma, which every Spanish keyboard offers first. */
export function parseHeightCm(input: string): number | null {
  const value = Number(input.replace(',', '.').trim());
  if (!Number.isFinite(value)) return null;
  return value >= MIN_HEIGHT_CM && value <= MAX_HEIGHT_CM ? value : null;
}

export function getAge(birthDate: Date | string | number): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
