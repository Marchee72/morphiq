export interface UserProfile {
  id?: string;
  name: string;
  gender: 'male' | 'female';
  age: number; // in years
  height: number; // in cm
  targetWeight?: number; // in kg
  targetBodyFat?: number; // in %
  createdAt: Date;
}
