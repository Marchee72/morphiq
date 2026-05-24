export interface FoodLog {
  id?: string;
  profileId: string;
  timestamp: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories: number;   // in kcal
  protein: number;    // in grams
  carbs: number;      // in grams
  fat: number;        // in grams
}
