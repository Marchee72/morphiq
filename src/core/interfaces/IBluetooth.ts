export interface IScaleData {
  weight: number;            // in kg
  impedance: number;         // in Ohms
  timestamp: Date;
  stabilized: boolean;       // weight has locked in
  impedancePresent: boolean; // BIA impedance is valid
}

export interface IBluetoothScaleAdapter {
  isSupported(): boolean;
  startScanning(
    onDataReceived: (data: IScaleData) => void,
    onError: (error: any) => void
  ): Promise<void>;
  stopScanning(): Promise<void>;
}
