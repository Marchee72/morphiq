import React, { useState } from 'react';
import { useT } from '../../i18n';
import type { FoodLog } from '../../core/entities/FoodLog';
import { AtlasSheet } from './AtlasSheet';
import { AtlasInput, AtlasChoice } from './AtlasField';

type MealType = FoodLog['mealType'];
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type Entry = Omit<FoodLog, 'id' | 'profileId' | 'timestamp'>;

export const AtlasAddFoodSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: Entry) => void;
}> = ({ open, onClose, onSubmit }) => {
  const { t } = useT();

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const num = (value: string) => Number(value.replace(',', '.')) || 0;
  const valid = description.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      mealType,
      description: description.trim(),
      calories: num(calories),
      protein: num(protein),
      carbs: num(carbs),
      fat: num(fat),
    });
    setDescription(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
  };

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('food.title')}
      subtitle={t('today.calories')}
      footer={
        <button className="at-btn" onClick={submit} disabled={!valid}>
          {t('common.save')}
        </button>
      }
    >
      <AtlasChoice
        label={t('food.meal')}
        value={mealType}
        onChange={setMealType}
        options={MEAL_TYPES.map(m => ({ value: m, label: t(`food.${m}`) }))}
      />

      <AtlasInput
        label={t('food.what')}
        value={description}
        onChange={setDescription}
        placeholder={t('food.whatPlaceholder')}
        autoFocus
      />

      <AtlasInput
        label={t('today.calories')}
        value={calories}
        onChange={setCalories}
        inputMode="numeric"
        suffix={t('unit.kcal')}
      />

      {/* Macros are optional — most entries are a name and a calorie count. */}
      <div className="at-macro-row">
        <AtlasInput label={t('today.protein')} value={protein} onChange={setProtein} inputMode="numeric" suffix={t('unit.g')} />
        <AtlasInput label={t('food.carbs')} value={carbs} onChange={setCarbs} inputMode="numeric" suffix={t('unit.g')} />
        <AtlasInput label={t('food.fat')} value={fat} onChange={setFat} inputMode="numeric" suffix={t('unit.g')} />
      </div>
    </AtlasSheet>
  );
};
