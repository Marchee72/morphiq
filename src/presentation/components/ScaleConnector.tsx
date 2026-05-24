import React from 'react';
import { useStore } from '../state/store';
import { Bluetooth, Activity, AlertCircle, Zap } from 'lucide-react';

export const ScaleConnector: React.FC = () => {
  const {
    isScanning,
    scaleError,
    scaleWeight,
    scaleImpedance,
    scaleStabilized,
    scaleImpedancePresent,
    isSimulator,
    startScaleScan,
    stopScaleScan,
    setSimulator,
  } = useStore();

  const handleToggleSimulator = () => {
    setSimulator(!isSimulator);
  };

  return (
    <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: '260px' }}>
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Bluetooth className={`w-5 h-5 ${isScanning ? 'text-teal-400 animate-pulse' : 'text-purple-400'}`} />
          <h2 className="text-xl font-bold">Body Composition Scale</h2>
        </div>
        <button
          onClick={handleToggleSimulator}
          className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition"
          title="Toggle between physical Bluetooth scale and simulated scale data"
        >
          {isSimulator ? (
            <>
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Simulator Mode</span>
            </>
          ) : (
            <>
              <Bluetooth className="w-3.5 h-3.5 text-teal-400" />
              <span>BLE Scale Mode</span>
            </>
          )}
        </button>
      </div>

      {scaleError && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{scaleError}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center items-center py-4">
        {isScanning ? (
          <div className="text-center w-full">
            {/* Live weight display */}
            <div className="text-6xl font-extrabold tracking-tight mb-2 flex justify-center items-baseline gap-1">
              <span className={scaleStabilized ? 'text-teal-400' : 'text-purple-400 animate-pulse'}>
                {scaleWeight > 0 ? scaleWeight.toFixed(1) : '---'}
              </span>
              <span className="text-sm font-medium text-gray-400">kg</span>
            </div>

            {/* Status indicator bar */}
            <div className="w-full max-w-md bg-white/5 h-2 rounded-full overflow-hidden mx-auto mb-4 relative">
              <div 
                className={`h-full transition-all duration-300 ${
                  scaleImpedancePresent 
                    ? 'w-full bg-teal-400' 
                    : scaleStabilized 
                    ? 'w-2/3 bg-purple-400' 
                    : 'w-1/3 bg-purple-500/50'
                }`}
              />
            </div>

            {/* Context message */}
            <p className="text-sm text-gray-300 flex items-center justify-center gap-2">
              <Activity className={`w-4 h-4 ${!scaleStabilized ? 'animate-spin' : ''}`} />
              {!scaleStabilized && 'Weighing... Stand still on the scale'}
              {scaleStabilized && !scaleImpedancePresent && 'Weight locked. Analyzing body composition (impedance)...'}
              {scaleStabilized && scaleImpedancePresent && 'Measurement completed and saved!'}
            </p>

            {scaleImpedancePresent && (
              <div className="mt-3 text-xs text-teal-300 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                <span>Impedance: {scaleImpedance} &Omega;</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-4 text-sm max-w-md">
              {isSimulator 
                ? 'Step on the virtual scale to simulate a body composition check (runs offline, no hardware required).' 
                : 'Connect to your Xiaomi Mi Body Composition Scale 2. Step barefoot on the scale to start.'}
            </p>
            <button
              onClick={startScaleScan}
              className="glow-btn flex items-center gap-2 mx-auto"
              style={{ padding: '12px 28px' }}
            >
              <Bluetooth className="w-5 h-5 text-black" />
              <span>Step on Scale</span>
            </button>
          </div>
        )}
      </div>

      {isScanning && (
        <button
          onClick={stopScaleScan}
          className="text-xs text-gray-400 hover:text-gray-200 mt-2 transition"
        >
          Cancel Scan
        </button>
      )}
    </div>
  );
};
