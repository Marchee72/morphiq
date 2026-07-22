import type { UserProfile } from '../../core/entities/UserProfile';
import { getAge } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';

export interface CoachContextData {
  profile: UserProfile | null;
  measurements: Measurement[];
  foodLogs: FoodLog[];
  workoutLogs: WorkoutLog[];
  activeWorkoutSets: Record<string, WorkoutSet[]>;
}

export function buildFullCoachContext(data: CoachContextData): string {
  const lines: string[] = [];

  lines.push('=== HISTORIAL Y CONTEXTO DEL USUARIO (MorphIQ Engine) ===');

  // 1. Perfil
  if (data.profile) {
    const p = data.profile;
    const age = p.birthDate ? getAge(p.birthDate) : null;
    lines.push('\n--- PERFIL ---');
    lines.push(`• Nombre: ${p.name || 'Usuario'}`);
    lines.push(`• Edad: ${age !== null && !isNaN(age) ? `${age} años` : 'No especificada'}`);
    lines.push(`• Sexo: ${p.gender || 'No especificado'}`);
    lines.push(`• Estatura: ${p.height || '--'} cm`);
    if (p.targetWeight) lines.push(`• Meta de Peso: ${p.targetWeight} kg`);
    if (p.targetCalories) lines.push(`• Meta de Calorías: ${p.targetCalories} kcal`);
    if (p.targetProtein) lines.push(`• Meta de Proteína: ${p.targetProtein} g`);
  } else {
    lines.push('\n--- PERFIL ---');
    lines.push('Sin perfil activo');
  }

  // 2. Composición Corporal & BIA
  lines.push('\n--- COMPOSICIÓN CORPORAL (BIA) ---');
  if (data.measurements && data.measurements.length > 0) {
    const sorted = [...data.measurements].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const latest = sorted[0];
    if (latest.weight) lines.push(`• Peso Actual: ${latest.weight} kg (${new Date(latest.timestamp).toLocaleDateString()})`);
    if (latest.bodyFat) lines.push(`• Grasa Corporal: ${latest.bodyFat.toFixed(1)}%`);
    if (latest.muscleMass) lines.push(`• Masa Muscular: ${latest.muscleMass.toFixed(1)} kg`);
    if (latest.bodyWater) lines.push(`• Agua Corporal: ${latest.bodyWater.toFixed(1)}%`);
    if (latest.visceralFat) lines.push(`• Grasa Visceral: Grado ${latest.visceralFat}`);
    if (sorted.length > 1) {
      const prev = sorted[1];
      if (latest.weight && prev.weight) {
        const diff = latest.weight - prev.weight;
        lines.push(`• Tendencia de Peso: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg vs medición anterior`);
      }
    }
  } else {
    lines.push('Sin registros de peso o BIA.');
  }

  // 3. Nutrición (últimos 7 días)
  lines.push('\n--- RESUMEN NUTRICIONAL (7 DÍAS) ---');
  if (data.foodLogs && data.foodLogs.length > 0) {
    const totalCal = data.foodLogs.reduce((sum, f) => sum + (f.calories || 0), 0);
    const totalProt = data.foodLogs.reduce((sum, f) => sum + (f.protein || 0), 0);
    const totalCarbs = data.foodLogs.reduce((sum, f) => sum + (f.carbs || 0), 0);
    const totalFat = data.foodLogs.reduce((sum, f) => sum + (f.fat || 0), 0);

    const uniqueDates = new Set(data.foodLogs.map(f => new Date(f.timestamp).toDateString()));
    const daysCount = Math.max(1, uniqueDates.size);

    lines.push(`• Promedio Diario: ${Math.round(totalCal / daysCount)} kcal | Prot: ${Math.round(totalProt / daysCount)}g | Carbs: ${Math.round(totalCarbs / daysCount)}g | Grasas: ${Math.round(totalFat / daysCount)}g`);
    lines.push(`• Comidas Ingresadas: ${data.foodLogs.length}`);
    
    // Summary of food items
    const sampleItems = data.foodLogs.slice(0, 5).map(f => f.description).filter(Boolean).join(', ');
    if (sampleItems) {
      lines.push(`• Ejemplos de Comidas: ${sampleItems}`);
    }
  } else {
    lines.push('Sin registros de nutrición recientes.');
  }

  // 4. Entrenamientos (últimos 14 días)
  lines.push('\n--- ENTRENAMIENTO Y GIMNASIO (14 DÍAS) ---');
  if (data.workoutLogs && data.workoutLogs.length > 0) {
    const sortedWorkouts = [...data.workoutLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    lines.push(`• Sesiones Realizadas: ${sortedWorkouts.length} entrenamientos`);

    sortedWorkouts.slice(0, 5).forEach((w, idx) => {
      const dateStr = new Date(w.timestamp).toLocaleDateString();
      lines.push(`  ${idx + 1}. [${dateStr}] ${w.type} (${w.duration} min)`);
      if (w.description) lines.push(`     Detalle: ${w.description}`);

      const sets = w.id ? data.activeWorkoutSets[w.id] : undefined;
      if (sets && sets.length > 0) {
        const exMap = new Map<string, { count: number; maxWt: number }>();
        sets.forEach(s => {
          const name = s.exerciseName || 'Ejercicio';
          const existing = exMap.get(name) || { count: 0, maxWt: 0 };
          exMap.set(name, {
            count: existing.count + 1,
            maxWt: Math.max(existing.maxWt, s.weight || 0),
          });
        });
        const summary = Array.from(exMap.entries())
          .map(([name, info]) => `${name} (${info.count} sets, máx ${info.maxWt}kg)`)
          .join('; ');
        lines.push(`     Ejercicios: ${summary}`);
      }
    });
  } else {
    lines.push('Sin entrenamientos registrados recientemente.');
  }

  lines.push('\nInstrucciones para el Coach: Responde siempre en español, de forma concisa, motivadora y basada estrictamente en los datos del usuario precedentes.');
  lines.push('=========================================================\n');

  return lines.join('\n');
}
