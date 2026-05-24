import { describe, it, expect } from 'vitest';
import { WebBluetoothScaleAdapter } from './WebBluetoothScale';

describe('WebBluetoothScaleAdapter - Data Parser', () => {
  it('should return null if the byte buffer is less than 13 bytes', () => {
    const data = new DataView(new ArrayBuffer(10));
    const result = WebBluetoothScaleAdapter.parseScaleData(data);
    expect(result).toBeNull();
  });

  it('should parse stable weight in Kilograms without impedance', () => {
    const buffer = new ArrayBuffer(13);
    const data = new DataView(buffer);

    // Control flags: bit 1 set to 1 (kg unit), bit 10 set to 1 (stabilized)
    // 0x0402 -> control1 = 0x02, control2 = 0x04
    data.setUint8(0, 0x02);
    data.setUint8(1, 0x04);

    // Date: 2026-05-24 14:00:00
    data.setUint16(2, 2026, true);
    data.setUint8(4, 5); // May
    data.setUint8(5, 24); // 24th
    data.setUint8(6, 14); // 14:00
    data.setUint8(7, 0);
    data.setUint8(8, 0);

    // Impedance: 0 (not measured/socks on)
    data.setUint16(9, 0, true);

    // Weight: 15000 (15000 / 200 = 75.0 kg)
    data.setUint16(11, 15000, true);

    const result = WebBluetoothScaleAdapter.parseScaleData(data);
    expect(result).not.toBeNull();
    expect(result!.weight).toBe(75.0);
    expect(result!.impedance).toBe(0);
    expect(result!.stabilized).toBe(true);
    expect(result!.impedancePresent).toBe(false);
    expect(result!.timestamp.getFullYear()).toBe(2026);
    expect(result!.timestamp.getMonth()).toBe(4); // 0-indexed in JS (May = 4)
    expect(result!.timestamp.getDate()).toBe(24);
  });

  it('should parse weight in lbs and active impedance', () => {
    const buffer = new ArrayBuffer(13);
    const data = new DataView(buffer);

    // Flags: bit 0 = 1 (lbs unit), bit 10 = 1 (stabilized), bit 14 = 1 (impedance present)
    // 0x4401 -> control1 = 0x01, control2 = 0x44
    data.setUint8(0, 0x01);
    data.setUint8(1, 0x44);

    // Date: 2026-05-24 14:00:00
    data.setUint16(2, 2026, true);
    data.setUint8(4, 5);
    data.setUint8(5, 24);
    data.setUint8(6, 14);
    data.setUint8(7, 0);
    data.setUint8(8, 0);

    // Impedance: 500 ohms
    data.setUint16(9, 500, true);

    // Weight: 16500 (16500 / 100 = 165.0 lbs)
    data.setUint16(11, 16500, true);

    const result = WebBluetoothScaleAdapter.parseScaleData(data);
    expect(result).not.toBeNull();
    expect(result!.weight).toBe(165.0);
    expect(result!.impedance).toBe(500);
    expect(result!.stabilized).toBe(true);
    expect(result!.impedancePresent).toBe(true);
  });

  it('should fallback to current date if parsed date is invalid', () => {
    const buffer = new ArrayBuffer(13);
    const data = new DataView(buffer);

    // Invalid date fields (year 0, month 99, etc.)
    data.setUint16(2, 0, true);
    data.setUint8(4, 99);

    const result = WebBluetoothScaleAdapter.parseScaleData(data);
    expect(result).not.toBeNull();
    expect(result!.timestamp).toBeInstanceOf(Date);
    // Should fallback to current time which is around the current year (2026)
    expect(result!.timestamp.getFullYear()).toBeGreaterThan(2020);
  });
});
