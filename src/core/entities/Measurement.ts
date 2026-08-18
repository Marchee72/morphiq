/**
 * A weigh-in.
 *
 * Visceral fat, metabolic age, protein % and body type used to live here too.
 * None of them exist in Health Connect — it has 45 record types and not one of
 * them is any of those — so nothing ever measured them; they were reverse
 * engineered Xiaomi scale formulas over height, weight, age and sex, with
 * impedance pinned at a constant. For a fixed profile that made visceral fat a
 * straight line in weight (0.48 per kg), so its chart was the weight chart
 * rescaled, presented as if a scale had read it. They were removed rather than
 * relabelled: a number nobody measured is not worth the pixels.
 *
 * What is left either comes off the scale (weight, body fat, water, bone, lean
 * mass) or is a derivation everyone already knows the meaning of (BMI, BMR).
 */
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
}
