import { describe, it, expect } from 'vitest';
import { BiaCalculator } from './BiaCalculator';

describe('BiaCalculator', () => {
  it('should calculate BMI correctly', () => {
    // 70kg / (1.75m * 1.75m) = 22.857
    const bmi = BiaCalculator.getBMI(70, 175);
    expect(bmi).toBeCloseTo(22.86, 1);
  });

  it('should calculate LBM coefficient correctly', () => {
    const lbm = BiaCalculator.getLBMCoefficient(75, 175, 25, 'male', 500);
    expect(lbm).toBeGreaterThan(40);
    expect(lbm).toBeLessThan(75);
  });

  it('should calculate fat percentage correctly', () => {
    const fat = BiaCalculator.getFatPercentage(75, 175, 25, 'male', 500);
    expect(fat).toBeGreaterThan(5);
    expect(fat).toBeLessThan(50);
  });

  it('should calculate BMR correctly for male and female', () => {
    const bmrMale = BiaCalculator.getBMR(75, 175, 25, 'male');
    const bmrFemale = BiaCalculator.getBMR(60, 165, 25, 'female');

    expect(bmrMale).toBeGreaterThan(1000);
    expect(bmrFemale).toBeGreaterThan(800);
  });

  it('should compile all calculations into a Measurement entity', () => {
    const report = BiaCalculator.calculateAll('profile-1', 75, 175, 25, 'male', 500);
    expect(report.profileId).toBe('profile-1');
    expect(report.weight).toBe(75);
    expect(report.impedance).toBe(500);
    expect(report.bmi).toBeCloseTo(24.5, 1);
    expect(report.bodyFat).toBeGreaterThan(5);
    expect(report.muscleMass).toBeGreaterThan(20);
    expect(report.boneMass).toBeGreaterThan(1);
    expect(report.bodyWater).toBeGreaterThan(30);
  });
});
