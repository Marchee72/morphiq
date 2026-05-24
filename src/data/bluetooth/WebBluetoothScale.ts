import { IBluetoothScaleAdapter, IScaleData } from '../../core/interfaces/IBluetooth';

export class WebBluetoothScaleAdapter implements IBluetoothScaleAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private onDataCallback: ((data: IScaleData) => void) | null = null;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.bluetooth !== 'undefined';
  }

  // Parse standard 13-byte Xiaomi Mi Body Composition Scale 2 payload
  public static parseScaleData(data: DataView): IScaleData | null {
    if (data.byteLength < 13) {
      return null;
    }

    const control1 = data.getUint8(0);
    const control2 = data.getUint8(1);
    const flags = (control2 << 8) | control1;

    // Unit parsing
    const isLbs = (flags & 0x0001) !== 0;
    const isKg = (flags & 0x0002) !== 0;
    const isJin = (flags & 0x0200) !== 0;

    // Status flags
    const stabilized = (flags & 0x0400) !== 0;
    const impedancePresent = (flags & 0x4000) !== 0;

    // Date parsing
    const year = data.getUint16(2, true);
    const month = data.getUint8(4);
    const day = data.getUint8(5);
    const hour = data.getUint8(6);
    const minute = data.getUint8(7);
    const second = data.getUint8(8);

    let timestamp: Date;
    try {
      // Validate date bounds, fallback to current time if invalid
      if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        timestamp = new Date(year, month - 1, day, hour, minute, second);
      } else {
        timestamp = new Date();
      }
    } catch {
      timestamp = new Date();
    }

    // Impedance parsing (bytes 9-10)
    const impedance = data.getUint16(9, true);

    // Weight parsing (bytes 11-12)
    const rawWeight = data.getUint16(11, true);
    let weight = rawWeight;

    if (isKg) {
      weight = rawWeight / 200; // Kilograms
    } else if (isLbs || isJin) {
      weight = rawWeight / 100; // Lbs or Jin
    } else {
      weight = rawWeight / 200; // Fallback to kg
    }

    return {
      weight,
      impedance,
      timestamp,
      stabilized,
      impedancePresent: impedancePresent && impedance > 0 && impedance <= 3000,
    };
  }

  async startScanning(
    onDataReceived: (data: IScaleData) => void,
    onError: (error: any) => void
  ): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser.');
    }

    this.onDataCallback = onDataReceived;

    try {
      // Filter for standard Body Composition Service (0x181B) or Weight Scale Service (0x181D)
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [0x181b] },
          { services: [0x181d] }
        ],
        optionalServices: [0x181b, 0x181d]
      });

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

      this.server = await this.device.gatt!.connect();

      // Look for Body Composition service first
      let service;
      try {
        service = await this.server.getPrimaryService(0x181b);
      } catch {
        service = await this.server.getPrimaryService(0x181d);
      }

      // Characteristics under standard services
      let charUuid = 0x2a9c; // Body Composition Measurement
      if (service.uuid.includes('181d')) {
        charUuid = 0x2a9d; // Weight Measurement
      }

      this.characteristic = await service.getCharacteristic(charUuid);
      
      this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value as DataView;
        const parsed = WebBluetoothScaleAdapter.parseScaleData(value);
        if (parsed && this.onDataCallback) {
          this.onDataCallback(parsed);
        }
      });

      await this.characteristic.startNotifications();
    } catch (err) {
      onError(err);
      this.stopScanning();
    }
  }

  private handleDisconnect() {
    if (this.onDataCallback) {
      // Trigger a final disconnect notification
    }
  }

  async stopScanning(): Promise<void> {
    try {
      if (this.characteristic) {
        await this.characteristic.stopNotifications();
      }
    } catch {}

    try {
      if (this.device && this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch {}

    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.onDataCallback = null;
  }
}

// MOCK SCALE SIMULATOR ADAPTER FOR WEB TESTING (offline mode)
export class MockScaleAdapter implements IBluetoothScaleAdapter {
  private timer: any = null;

  isSupported(): boolean {
    return true;
  }

  async startScanning(
    onDataReceived: (data: IScaleData) => void,
    onError: (error: any) => void
  ): Promise<void> {
    let seconds = 0;
    let weight = 60 + Math.random() * 20; // Random starting weight
    const targetWeight = weight + (Math.random() - 0.5) * 2;
    const impedance = 450 + Math.floor(Math.random() * 100);

    this.timer = setInterval(() => {
      seconds += 1;

      // Simulate weight fluctuating, then stabilizing
      if (seconds < 5) {
        // Fluctuating
        weight = weight + (targetWeight - weight) * 0.4 + (Math.random() - 0.5) * 0.5;
        onDataReceived({
          weight: Math.round(weight * 10) / 10,
          impedance: 0,
          timestamp: new Date(),
          stabilized: false,
          impedancePresent: false,
        });
      } else if (seconds >= 5 && seconds < 8) {
        // Stabilized weight, measuring impedance
        onDataReceived({
          weight: Math.round(targetWeight * 10) / 10,
          impedance: 0,
          timestamp: new Date(),
          stabilized: true,
          impedancePresent: false,
        });
      } else {
        // Impedance complete
        onDataReceived({
          weight: Math.round(targetWeight * 10) / 10,
          impedance,
          timestamp: new Date(),
          stabilized: true,
          impedancePresent: true,
        });
        clearInterval(this.timer);
      }
    }, 1000);
  }

  async stopScanning(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
