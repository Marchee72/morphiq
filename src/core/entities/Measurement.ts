export interface Measurement {
  id?: string;
  profileId: string;
  timestamp: Date;
  weight: number;      // in kg
  impedance: number;   // in Ohms
  bmi: number;
  bmr: number;         // in kcal
  bodyFat: number;     // in %
  bodyWater: number;   // in %
  boneMass: number;    // in kg
  muscleMass: number;  // in kg
  visceralFat: number; // index (1-50)
  metabolicAge: number; // in years
  protein: number;     // in %
  bodyType: number;    // index (0-8)
}
