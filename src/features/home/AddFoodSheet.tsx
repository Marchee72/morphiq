import React, { useState } from 'react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Chip } from '../../ui/primitives/Chip';
import { Button } from '../../ui/primitives/Button';
import type { FoodLog } from '../../core/entities/FoodLog';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 48, padding: '10px 14px', borderRadius: 16, border: '1.5px solid var(--ui-outline-strong)', background: 'var(--ui-bg)', color: 'var(--ui-text-primary)', fontSize: 16 };

export const AddFoodSheet: React.FC<{ open: boolean; onClose: () => void; onSubmit: (e: Omit<FoodLog, 'id'|'profileId'|'timestamp'>) => void }> = ({ open, onClose, onSubmit }) => {
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDesc] = useState('');
  const [calories, setCal] = useState('');
  const [protein, setProt] = useState('');
  const [carbs, setCarb] = useState('');
  const [fat, setFat] = useState('');

  const save = () => { if (!description.trim()) return; onSubmit({ mealType, description: description.trim(), calories: Number(calories)||0, protein: Number(protein)||0, carbs: Number(carbs)||0, fat: Number(fat)||0 }); setDesc(''); setCal(''); setProt(''); setCarb(''); setFat(''); onClose(); };

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {MEAL_TYPES.map(m => <Chip key={m} selected={mealType===m} onClick={()=>setMealType(m)}>{m[0].toUpperCase()+m.slice(1)}</Chip>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)' }}>Description<input aria-label="Description" style={inputStyle} value={description} onChange={e=>setDesc(e.target.value)} placeholder="Chicken bowl"/></label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)'}}>Calories<input aria-label="Calories" style={inputStyle} inputMode="numeric" value={calories} onChange={e=>setCal(e.target.value)}/></label>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)'}}>Protein<input aria-label="Protein" style={inputStyle} inputMode="numeric" value={protein} onChange={e=>setProt(e.target.value)}/></label>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)'}}>Carbs<input aria-label="Carbs" style={inputStyle} inputMode="numeric" value={carbs} onChange={e=>setCarb(e.target.value)}/></label>
          <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--ui-text-secondary)'}}>Fat<input aria-label="Fat" style={inputStyle} inputMode="numeric" value={fat} onChange={e=>setFat(e.target.value)}/></label>
        </div>
        <Button onClick={save} disabled={!description.trim()}>Save</Button>
      </div>
    </Sheet>
  );
};
