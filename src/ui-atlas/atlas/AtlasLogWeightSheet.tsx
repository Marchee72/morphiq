import React, { useState } from 'react';
import { useT } from '../../i18n';
import { AtlasSheet } from './AtlasSheet';
import { AtlasInput } from './AtlasField';

const MIN_KG = 15;
const MAX_KG = 400;

export const AtlasLogWeightSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (kg: number) => void;
}> = ({ open, onClose, onSubmit }) => {
  const { t } = useT();
  const [value, setValue] = useState('');

  const kg = Number(value.replace(',', '.'));
  const valid = Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;

  const submit = () => {
    if (!valid) return;
    onSubmit(kg);
    setValue('');
  };

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
        hint={value && !valid ? t('onboarding.heightRange', { min: MIN_KG, max: MAX_KG }) : undefined}
      />
    </AtlasSheet>
  );
};
