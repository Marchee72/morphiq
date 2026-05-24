import React from 'react';
import { useStore } from '../state/store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar, Trash2, TrendingDown, TrendingUp, Award, Thermometer, User } from 'lucide-react';
import { BiaCalculator } from '../../data/calculation/BiaCalculator';

export const AnalyticsDashboard: React.FC = () => {
  const { measurements, deleteMeasurement, activeProfile } = useStore();

  if (!activeProfile) {
    return (
      <div className="glass-panel p-8 text-center text-gray-400">
        <User className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-400" />
        <p>No user profile selected. Please create or choose a profile to begin.</p>
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-gray-400">
        <Award className="w-12 h-12 mx-auto mb-3 opacity-30 text-teal-400" />
        <h3 className="text-lg font-bold mb-1 text-gray-300">Welcome, {activeProfile.name}!</h3>
        <p className="text-sm max-w-sm mx-auto">
          No body composition records found. Connect to your scale or run the simulator above to log your first check-in!
        </p>
      </div>
    );
  }

  const latest = measurements[measurements.length - 1];

  // Helper to resolve body type name
  const bodyTypes = [
    'Obese',
    'Overweight',
    'Thick-set',
    'Lack of Exercise',
    'Balanced',
    'Balanced Muscular',
    'Skinny',
    'Balanced Skinny',
    'Skinny Muscular',
  ];
  const bodyType = bodyTypes[latest.bodyType] || 'Unknown';

  // Format historical records for chart
  const chartData = measurements.map(m => ({
    date: new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    weight: Number(m.weight.toFixed(1)),
    fat: Number(m.bodyFat.toFixed(1)),
  }));

  // Calculate trends comparing first and latest log
  const weightDelta = measurements.length > 1 ? latest.weight - measurements[0].weight : 0;

  // Determine scale levels (low, normal, high, etc.) using BiaCalculator helper scales
  const fatScale = BiaCalculator.getFatPercentageScale(activeProfile.age, activeProfile.gender);
  let fatLevel = 'Normal';
  let fatColor = 'text-teal-400';
  if (latest.bodyFat > fatScale[2]) {
    fatLevel = 'High';
    fatColor = 'text-rose-400';
  } else if (latest.bodyFat < fatScale[1]) {
    fatLevel = 'Low';
    fatColor = 'text-purple-400';
  }

  const muscleScale = BiaCalculator.getMuscleMassScale(activeProfile.height, activeProfile.gender);
  let muscleLevel = 'Normal';
  let muscleColor = 'text-teal-400';
  if (latest.muscleMass > muscleScale[1]) {
    muscleLevel = 'High';
    muscleColor = 'text-purple-400';
  } else if (latest.muscleMass < muscleScale[0]) {
    muscleLevel = 'Low';
    muscleColor = 'text-rose-400';
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Core Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weight Card */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Current Weight</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-5xl font-extrabold text-white">{latest.weight.toFixed(1)}</span>
            <span className="text-sm font-semibold text-gray-400">kg</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs">
            {weightDelta !== 0 ? (
              weightDelta < 0 ? (
                <>
                  <div className="p-1 rounded bg-teal-500/10 text-teal-400">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-teal-300 font-medium">Lost {Math.abs(weightDelta).toFixed(1)} kg</span>
                </>
              ) : (
                <>
                  <div className="p-1 rounded bg-rose-500/10 text-rose-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-rose-300 font-medium">Gained {weightDelta.toFixed(1)} kg</span>
                </>
              )
            ) : (
              <span className="text-gray-500">First measurement logged</span>
            )}
            <span className="text-gray-500">since start</span>
          </div>
        </div>

        {/* Fat Card */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Body Fat</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-5xl font-extrabold text-white">{latest.bodyFat.toFixed(1)}</span>
            <span className="text-sm font-semibold text-gray-400">%</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs">
            <span className={`font-semibold ${fatColor}`}>{fatLevel} Range</span>
            <span className="text-gray-500">({fatScale[1]}% - {fatScale[2]}% normal)</span>
          </div>
        </div>

        {/* Muscle Card */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Muscle Mass</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-5xl font-extrabold text-white">{latest.muscleMass.toFixed(1)}</span>
            <span className="text-sm font-semibold text-gray-400">kg</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs">
            <span className={`font-semibold ${muscleColor}`}>{muscleLevel} Volume</span>
            <span className="text-gray-400">Body Type: <strong>{bodyType}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Trends Chart */}
      <div className="glass-panel p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          <span>Progress Timeline</span>
        </h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tickLine={false} style={{ fontSize: '11px' }} />
              <YAxis yAxisId="left" stroke="rgba(192, 132, 252, 0.7)" style={{ fontSize: '11px' }} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(45, 212, 191, 0.7)" style={{ fontSize: '11px' }} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#12141a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} 
              />
              <Line yAxisId="left" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#c084fc" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="fat" name="Fat (%)" stroke="#2dd4bf" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Detailed Health Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* BMR */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Basal Metabolism</span>
          <span className="text-2xl font-bold block">{latest.bmr.toFixed(0)}</span>
          <span className="text-[10px] text-gray-500">kcal/day</span>
        </div>
        {/* Visceral Fat */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Visceral Fat Index</span>
          <span className={`text-2xl font-bold block ${latest.visceralFat >= 10 ? 'text-rose-400' : 'text-teal-400'}`}>
            {latest.visceralFat}
          </span>
          <span className="text-[10px] text-gray-500">{latest.visceralFat >= 10 ? 'High' : 'Normal'} (limit: &lt;10)</span>
        </div>
        {/* Body Water */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Body Water</span>
          <span className="text-2xl font-bold block">{latest.bodyWater.toFixed(1)}%</span>
          <span className="text-[10px] text-gray-500">Total Body Water</span>
        </div>
        {/* Bone Mass */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Bone Mass</span>
          <span className="text-2xl font-bold block">{latest.boneMass.toFixed(2)} kg</span>
          <span className="text-[10px] text-gray-500">Skeleton weight</span>
        </div>
        {/* Protein */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Protein</span>
          <span className="text-2xl font-bold block">{latest.protein.toFixed(1)}%</span>
          <span className="text-[10px] text-gray-500">Muscle building blocks</span>
        </div>
        {/* Metabolic Age */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Metabolic Age</span>
          <span className="text-2xl font-bold block text-purple-400">{latest.metabolicAge}</span>
          <span className="text-[10px] text-gray-500">years old</span>
        </div>
        {/* BMI */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">BMI</span>
          <span className="text-2xl font-bold block">{latest.bmi.toFixed(1)}</span>
          <span className="text-[10px] text-gray-500">Body Mass Index</span>
        </div>
        {/* Ideal Weight */}
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Ideal Weight</span>
          <span className="text-2xl font-bold block text-teal-400">
            {BiaCalculator.getIdealWeight(activeProfile.height, activeProfile.gender).toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500">kg (height-based)</span>
        </div>
      </div>

      {/* 4. Historical Log Table */}
      <div className="glass-panel p-5 overflow-hidden">
        <h2 className="text-lg font-bold mb-4">Measurement Log History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-gray-400">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Weight</th>
                <th className="py-2.5 px-3">Fat %</th>
                <th className="py-2.5 px-3">Muscle</th>
                <th className="py-2.5 px-3">BMR</th>
                <th className="py-2.5 px-3">Age</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {measurements.slice().reverse().map((m) => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/2 transition">
                  <td className="py-2.5 px-3 text-gray-300">
                    {new Date(m.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white">{m.weight.toFixed(1)} kg</td>
                  <td className="py-2.5 px-3 text-teal-400">{m.bodyFat.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-purple-400">{m.muscleMass.toFixed(1)} kg</td>
                  <td className="py-2.5 px-3">{m.bmr.toFixed(0)}</td>
                  <td className="py-2.5 px-3 text-gray-400">{m.metabolicAge} yrs</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => m.id && deleteMeasurement(m.id)}
                      className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-red-400 rounded transition"
                      title="Delete measurement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
