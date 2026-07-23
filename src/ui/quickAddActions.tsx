import { Scale, UtensilsCrossed, Dumbbell } from 'lucide-react';
import type { QuickAddAction } from './primitives/QuickAdd';

export const buildQuickAddActions = (callbacks: {
  onLogWeight: () => void;
  onAddFood: () => void;
  onStartWorkout: () => void;
}): QuickAddAction[] => [
  { id: 'weight', label: 'Log weight', icon: <Scale size={18} />, onClick: callbacks.onLogWeight },
  { id: 'food', label: 'Add food', icon: <UtensilsCrossed size={18} />, onClick: callbacks.onAddFood },
  { id: 'workout', label: 'Start workout', icon: <Dumbbell size={18} />, onClick: callbacks.onStartWorkout },
];
