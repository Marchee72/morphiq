import React, { useState } from 'react';
import { useT } from '../../i18n';
import { AtlasSheet } from './AtlasSheet';
import { AtlasInput } from './AtlasField';
import type { ManualBia } from '../../presentation/state/store';

const MIN_KG = 15;
const MAX_KG = 400;

/** Plausible ranges for what someone reads off a scale, not clinical limits. */
const RANGES = {
  bodyFat: { min: 2, max: 70 },
  muscleMass: { min: 5, max: 120 },
  bodyWater: { min: 20, max: 80 },
} as const;

type BiaField = keyof typeof RANGES;

const parse = (raw: string) => Number(raw.replace(',', '.'));

/**
 * Empty is valid — these are optional. A value outside its range is not, so it
 * blocks the save rather than being silently dropped into a chart.
 */
function biaState(raw: string, field: BiaField) {
  if (!raw.trim()) return { value: undefined, valid: true };
  const n = parse(raw);
  const { min, max } = RANGES[field];
  return { value: n, valid: Number.isFinite(n) && n >= min && n <= max };
}

export const AtlasLogWeightSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (kg: number, bia?: ManualBia) => void;
}> = ({ open, onClose, onSubmit }) => {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [bodyWater, setBodyWater] = useState('');

  const kg = parse(value);
  const weightValid = Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;

  const fat = biaState(bodyFat, 'bodyFat');
  const muscle = biaState(muscleMass, 'muscleMass');
  const water = biaState(bodyWater, 'bodyWater');
  const valid = weightValid && fat.valid && muscle.valid && water.valid;

  const submit = () => {
    if (!valid) return;
    const bia: ManualBia = {
      bodyFat: fat.value,
      muscleMass: muscle.value,
      bodyWater: water.value,
    };
    // Weight on its own must stay weight on its own: the store reads a missing
    // body fat as "not measured", and passing an empty object would not change
    // that, but sending nothing says it plainly.
    const anyBia = fat.value !== undefined || muscle.value !== undefined || water.value !== undefined;
    onSubmit(kg, anyBia ? bia : undefined);
    setValue(''); setBodyFat(''); setMuscleMass(''); setBodyWater('');
  };

  const rangeHint = (raw: string, state: { valid: boolean }, field: BiaField) =>
    raw && !state.valid
      ? t('onboarding.heightRange', { min: RANGES[field].min, max: RANGES[field].max })
      : undefined;

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('body.newReading')}
      subtitle={t('today.weight')}
      footer={
        <button className="at-btn" onClick={submit} disabled={!valid}>
          {t('common.save')}
        </button>
      }
    >
      <AtlasInput
        label={t('today.weight')}
        value={value}
        onChange={setValue}
        inputMode="decimal"
        placeholder="78.4"
        suffix={t('unit.kg')}
        autoFocus
        hint={value && !weightValid ? t('onboarding.heightRange', { min: MIN_KG, max: MAX_KG }) : undefined}
      />

      {/* Only the three a scale genuinely measures. The rest of the Body screen
          is derived from these, so offering them as inputs would invite someone
          to type a figure the app then presents as its own calculation. */}
      <div className="at-field">
        <span className="at-field-label">{t('body.manualBia')}</span>
        <small className="at-field-hint">{t('body.manualBiaSub')}</small>
      </div>

      <AtlasInput
        label={t('body.metric.bodyFat')}
        value={bodyFat}
        onChange={setBodyFat}
        inputMode="decimal"
        placeholder="18.2"
        suffix={t('unit.pct')}
        hint={rangeHint(bodyFat, fat, 'bodyFat')}
      />
      <AtlasInput
        label={t('body.metric.muscleMass')}
        value={muscleMass}
        onChange={setMuscleMass}
        inputMode="decimal"
        placeholder="34.1"
        suffix={t('unit.kg')}
        hint={rangeHint(muscleMass, muscle, 'muscleMass')}
      />
      <AtlasInput
        label={t('body.metric.bodyWater')}
        value={bodyWater}
        onChange={setBodyWater}
        inputMode="decimal"
        placeholder="55.0"
        suffix={t('unit.pct')}
        hint={rangeHint(bodyWater, water, 'bodyWater')}
      />
    </AtlasSheet>
  );
};
