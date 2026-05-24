import React, { useState } from 'react';
import { useStore } from '../state/store';
import { Plus, Trash2, ArrowLeft, ArrowRight, Activity, Apple } from 'lucide-react';

export const DailyLog: React.FC = () => {
  const {
    foodLogs,
    workoutLogs,
    addFoodLog,
    deleteFoodLog,
    addWorkoutLog,
    deleteWorkoutLog,
    selectedDate,
    setSelectedDate,
    activeProfile,
    measurements
  } = useStore();

  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [foodDesc, setFoodDesc] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [foodProt, setFoodProt] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');

  const [workoutType, setWorkoutType] = useState('');
  const [workoutDuration, setWorkoutDuration] = useState('');
  const [workoutDesc, setWorkoutDesc] = useState('');
  const [workoutCals, setWorkoutCals] = useState('');

  if (!activeProfile) return null;

  // Change date helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  // Summarize metrics
  const totalEaten = foodLogs.reduce((acc, f) => acc + f.calories, 0);
  const totalProt = foodLogs.reduce((acc, f) => acc + f.protein, 0);
  const totalCarbs = foodLogs.reduce((acc, f) => acc + f.carbs, 0);
  const totalFat = foodLogs.reduce((acc, f) => acc + f.fat, 0);

  const totalBurned = workoutLogs.reduce((acc, w) => acc + (w.caloriesBurned || 0), 0);
  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : undefined;
  const bmr = latestMeasurement ? latestMeasurement.bmr : 1800; // fallback BMR

  const calorieBalance = totalEaten - bmr - totalBurned;

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodDesc.trim() || !foodCals) return;

    await addFoodLog({
      mealType,
      description: foodDesc.trim(),
      calories: Number(foodCals),
      protein: Number(foodProt) || 0,
      carbs: Number(foodCarbs) || 0,
      fat: Number(foodFat) || 0,
    });

    // Reset inputs
    setFoodDesc('');
    setFoodCals('');
    setFoodProt('');
    setFoodCarbs('');
    setFoodFat('');
  };

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutType.trim() || !workoutDuration) return;

    await addWorkoutLog({
      type: workoutType.trim(),
      duration: Number(workoutDuration),
      description: workoutDesc.trim(),
      caloriesBurned: Number(workoutCals) || 0,
    });

    // Reset inputs
    setWorkoutType('');
    setWorkoutDuration('');
    setWorkoutDesc('');
    setWorkoutCals('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Date Header Switcher */}
      <div className="glass-panel p-4 flex justify-between items-center bg-white/2">
        <button onClick={handlePrevDay} className="p-2 hover:bg-white/5 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <span className="font-bold text-lg text-white">
          {selectedDate.toDateString() === new Date().toDateString()
            ? 'Today'
            : selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <button onClick={handleNextDay} className="p-2 hover:bg-white/5 rounded-lg transition">
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Daily Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Calories Consumed</span>
          <span className="text-2xl font-bold block text-purple-400">{totalEaten}</span>
          <span className="text-[10px] text-gray-500">kcal from meals</span>
        </div>
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">BMR (Metabolic Output)</span>
          <span className="text-2xl font-bold block text-gray-300">{bmr.toFixed(0)}</span>
          <span className="text-[10px] text-gray-500">kcal target base</span>
        </div>
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Workout Burn</span>
          <span className="text-2xl font-bold block text-teal-400">{totalBurned}</span>
          <span className="text-[10px] text-gray-500">kcal from exercise</span>
        </div>
        <div className="glass-panel p-4 text-center">
          <span className="text-xs text-gray-400 block mb-1">Calorie Balance</span>
          <span className={`text-2xl font-bold block ${calorieBalance < 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {calorieBalance > 0 ? `+${calorieBalance}` : calorieBalance}
          </span>
          <span className="text-[10px] text-gray-500">{calorieBalance < 0 ? 'Caloric Deficit' : 'Caloric Surplus'}</span>
        </div>
      </div>

      {/* Grid: Food Logging & Workout Logging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Diet section */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Apple className="w-5 h-5 text-purple-400" />
              <span>Log Meals & Nutrition</span>
            </h2>
            <form onSubmit={handleAddFood} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as any)}
                  className="bg-black/40 text-sm"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
                <input
                  type="number"
                  placeholder="Calories (kcal)"
                  value={foodCals}
                  onChange={(e) => setFoodCals(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="0"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Description (e.g., Oatmeal with Berries)"
                value={foodDesc}
                onChange={(e) => setFoodDesc(e.target.value)}
                className="bg-black/40 text-sm"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder="Protein (g)"
                  value={foodProt}
                  onChange={(e) => setFoodProt(e.target.value)}
                  className="bg-black/40 text-xs"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Carbs (g)"
                  value={foodCarbs}
                  onChange={(e) => setFoodCarbs(e.target.value)}
                  className="bg-black/40 text-xs"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Fat (g)"
                  value={foodFat}
                  onChange={(e) => setFoodFat(e.target.value)}
                  className="bg-black/40 text-xs"
                  min="0"
                />
              </div>
              <button type="submit" className="glow-btn flex items-center justify-center gap-1">
                <Plus className="w-4 h-4 text-black" />
                <span>Add Food</span>
              </button>
            </form>
          </div>

          {/* Food log list */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Logged Meals</h3>
            {foodLogs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No meals logged for this date.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {foodLogs.map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-white/2 border border-white/5 p-3 rounded-lg hover:bg-white/4 transition">
                    <div>
                      <span className="text-[10px] bg-purple-500/10 text-purple-300 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5">
                        {f.mealType}
                      </span>
                      <h4 className="font-semibold text-sm text-white">{f.description}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Protein: {f.protein}g | Carbs: {f.carbs}g | Fat: {f.fat}g
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-white">{f.calories} kcal</span>
                      <button
                        onClick={() => f.id && deleteFoodLog(f.id)}
                        className="p-1.5 hover:bg-white/5 text-gray-500 hover:text-red-400 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Total macro summary */}
                <div className="border-t border-white/5 mt-2 pt-3 flex justify-between text-xs text-gray-400">
                  <span>Macros Total:</span>
                  <span>Protein: <strong>{totalProt}g</strong> | Carbs: <strong>{totalCarbs}g</strong> | Fat: <strong>{totalFat}g</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workout section */}
        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              <span>Log Gym Workouts</span>
            </h2>
            <form onSubmit={handleAddWorkout} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Workout Type (e.g. Run, Lift)"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="bg-black/40 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Duration (mins)"
                  value={workoutDuration}
                  onChange={(e) => setWorkoutDuration(e.target.value)}
                  className="bg-black/40 text-sm"
                  min="1"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Workout details (e.g. Chest & Triceps routine)"
                value={workoutDesc}
                onChange={(e) => setWorkoutDesc(e.target.value)}
                className="bg-black/40 text-sm"
                required
              />
              <input
                type="number"
                placeholder="Calories Burned (kcal)"
                value={workoutCals}
                onChange={(e) => setWorkoutCals(e.target.value)}
                className="bg-black/40 text-sm"
                min="0"
              />
              <button type="submit" className="glow-btn flex items-center justify-center gap-1" style={{ background: 'linear-gradient(135deg, var(--accent-teal), #0ea5e9)' }}>
                <Plus className="w-4 h-4 text-black" />
                <span className="text-black">Add Workout</span>
              </button>
            </form>
          </div>

          {/* Workout log list */}
          <div className="glass-panel p-5">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Logged Workouts</h3>
            {workoutLogs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No exercises logged for this date.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {workoutLogs.map(w => (
                  <div key={w.id} className="flex justify-between items-center bg-white/2 border border-white/5 p-3 rounded-lg hover:bg-white/4 transition">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-teal-500/10 text-teal-300 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                          {w.type}
                        </span>
                        <span className="text-xs text-gray-400">{w.duration} mins</span>
                      </div>
                      <h4 className="font-semibold text-sm text-white">{w.description}</h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-white">{w.caloriesBurned} kcal</span>
                      <button
                        onClick={() => w.id && deleteWorkoutLog(w.id)}
                        className="p-1.5 hover:bg-white/5 text-gray-500 hover:text-red-400 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
