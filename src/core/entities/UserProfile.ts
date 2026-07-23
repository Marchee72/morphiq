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
