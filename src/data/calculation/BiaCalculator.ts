import type { Measurement } from '../../core/entities/Measurement';

/**
 * The impedance to assume when a reading arrives without one.
 *
 * Health Connect carries no impedance field, and nobody types one in by hand —
 * but half the formulas here need a number. 500 Ω sits in the middle of the
 * adult range, so it shifts the derived figures as little as any single value
 * can. Every metric computed from it is a formula over height/age/sex, not a
 * measurement, which is why `isMeasured` in `bodyMetrics.ts` keeps them apart in
 * the UI.
 */
export const NEUTRAL_IMPEDANCE = 500;

export class BiaCalculator {
  // Clamp value to boundaries
  private static checkValueOverflow(value: number, minimum: number, maximum: number): number {
    if (value < minimum) return minimum;
    if (value > maximum) return maximum;
    return value;
  }

  // Get LBM coefficient (with impedance)
  public static getLBMCoefficient(
    weight: number,
    height: number,
    age: number,
    _gender: 'male' | 'female',
    impedance: number
  ): number {
    let lbm = (height * 9.058 / 100) * (height / 100);
    lbm += weight * 0.32 + 12.226;
    lbm -= impedance * 0.0068;
    lbm -= age * 0.0542;
    return lbm;
  }

  // Get Body Fat Percentage
  public static getFatPercentage(
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female',
    impedance: number
  ): number {
    // Set a constant to remove from LBM
    let constVal = 0.8;
    if (gender === 'female') {
      constVal = age <= 49 ? 9.25 : 7.25;
    }

    const LBM = this.getLBMCoefficient(weight, height, age, gender, impedance);

    // Calculate body fat percentage coefficient
    let coefficient = 1.0;
    if (gender === 'male' && weight < 61) {
      coefficient = 0.98;
    } else if (gender === 'female') {
      if (weight > 60) {
        coefficient = 0.96;
        if (height > 160) {
          coefficient *= 1.03;
        }
      } else if (weight < 50) {
        coefficient = 1.02;
        if (height > 160) {
          coefficient *= 1.03;
        }
      }
    }

    let fatPercentage = (1.0 - (((LBM - constVal) * coefficient) / weight)) * 100;

    // Capping body fat percentage
    if (fatPercentage > 63) {
      fatPercentage = 75;
    }

    return this.checkValueOverflow(fatPercentage, 5, 75);
  }

  // Get Water Percentage
  public static getWaterPercentage(
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female',
    impedance: number
  ): number {
    const fat = this.getFatPercentage(weight, height, age, gender, impedance);
    const waterPercentage = (100 - fat) * 0.7;

    const coefficient = waterPercentage <= 50 ? 1.02 : 0.98;

    // Capping water percentage
    if (waterPercentage * coefficient >= 65) {
      return 75; // directly return the capped value
    }

    return this.checkValueOverflow(waterPercentage * coefficient, 35, 75);
  }

  // Get Bone Mass
  public static getBoneMass(
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female',
    impedance: number
  ): number {
    const base = gender === 'female' ? 0.245691014 : 0.18016894;
    const LBM = this.getLBMCoefficient(weight, height, age, gender, impedance);
    let boneMass = (base - (LBM * 0.05158)) * -1;

    if (boneMass > 2.2) {
      boneMass += 0.1;
    } else {
      boneMass -= 0.1;
    }

    // Capping boneMass
    if (gender === 'female' && boneMass > 5.1) {
      boneMass = 8;
    } else if (gender === 'male' && boneMass > 5.2) {
      boneMass = 8;
    }

    return this.checkValueOverflow(boneMass, 0.5, 8);
  }

  // Get Muscle Mass
  public static getMuscleMass(
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female',
    impedance: number
  ): number {
    const fat = this.getFatPercentage(weight, height, age, gender, impedance);
    const bone = this.getBoneMass(weight, height, age, gender, impedance);
    let muscleMass = weight - ((fat * 0.01) * weight) - bone;

    // Capping muscle mass
    if (gender === 'female' && muscleMass >= 84) {
      muscleMass = 120;
    } else if (gender === 'male' && muscleMass >= 93.5) {
      muscleMass = 120;
    }

    return this.checkValueOverflow(muscleMass, 10, 120);
  }


  // Get BMR
  public static getBMR(
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female'
  ): number {
    let bmr: number;
    if (gender === 'female') {
      bmr = 864.6 + weight * 10.2036 - height * 0.39336 - age * 6.204;
      if (bmr > 2996) bmr = 5000;
    } else {
      bmr = 877.8 + weight * 14.916 - height * 0.726 - age * 8.976;
      if (bmr > 2322) bmr = 5000;
    }

    return this.checkValueOverflow(bmr, 500, 10000);
  }



  // Get BMI
  public static getBMI(weight: number, height: number): number {
    const bmi = weight / ((height / 100) * (height / 100));
    return this.checkValueOverflow(bmi, 10, 90);
  }

  // Get Ideal Weight
  public static getIdealWeight(height: number, gender: 'male' | 'female'): number {
    if (gender === 'female') {
      return (height - 70) * 0.6;
    } else {
      return (height - 80) * 0.7;
    }
  }

  // Get Muscle Mass Scale boundaries [min, max]
  public static getMuscleMassScale(height: number, gender: 'male' | 'female'): [number, number] {
    const scales: Array<{ min: { male: number; female: number }; female: [number, number]; male: [number, number] }> = [
      { min: { male: 170, female: 160 }, female: [36.5, 42.6], male: [49.4, 59.5] },
      { min: { male: 160, female: 150 }, female: [32.9, 37.6], male: [44.0, 52.5] },
      { min: { male: 0, female: 0 }, female: [29.1, 34.8], male: [38.5, 46.6] },
    ];

    for (const scale of scales) {
      if (height >= scale.min[gender]) {
        return scale[gender];
      }
    }
    return [38.5, 46.6]; // default fallback
  }

  // Get Fat Percentage Scale boundaries [min_normal, min_high, min_veryhigh, max_veryhigh]
  public static getFatPercentageScale(age: number, gender: 'male' | 'female'): [number, number, number, number] {
    const scales = [
      { min: 0, max: 11, female: [12.0, 21.0, 30.0, 34.0], male: [7.0, 16.0, 25.0, 30.0] },
      { min: 12, max: 13, female: [15.0, 24.0, 33.0, 37.0], male: [7.0, 16.0, 25.0, 30.0] },
      { min: 14, max: 15, female: [18.0, 27.0, 36.0, 40.0], male: [7.0, 16.0, 25.0, 30.0] },
      { min: 16, max: 17, female: [20.0, 28.0, 37.0, 41.0], male: [7.0, 16.0, 25.0, 30.0] },
      { min: 18, max: 39, female: [21.0, 28.0, 35.0, 40.0], male: [11.0, 17.0, 22.0, 27.0] },
      { min: 40, max: 59, female: [22.0, 29.0, 36.0, 41.0], male: [12.0, 18.0, 23.0, 28.0] },
      { min: 60, max: 100, female: [23.0, 30.0, 37.0, 42.0], male: [14.0, 20.0, 25.0, 30.0] },
    ];

    for (const scale of scales) {
      if (age >= scale.min && age <= scale.max) {
        return scale[gender] as [number, number, number, number];
      }
    }
    return gender === 'female' ? [21.0, 28.0, 35.0, 40.0] : [11.0, 17.0, 22.0, 27.0]; // default fallback
  }


  // Get full metrics report
  public static calculateAll(
    profileId: string,
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female',
    impedance: number
  ): Measurement {
    return {
      profileId,
      timestamp: new Date(),
      weight,
      impedance,
      bmi: this.getBMI(weight, height),
      bmr: this.getBMR(weight, height, age, gender),
      bodyFat: this.getFatPercentage(weight, height, age, gender, impedance),
      bodyWater: this.getWaterPercentage(weight, height, age, gender, impedance),
      boneMass: this.getBoneMass(weight, height, age, gender, impedance),
      muscleMass: this.getMuscleMass(weight, height, age, gender, impedance),
    };
  }
}
