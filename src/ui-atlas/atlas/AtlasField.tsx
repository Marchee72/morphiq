import React, { useId } from 'react';

/**
 * Form controls in Atlas's language.
 *
 * Every field is label-linked rather than relying on placeholders: a placeholder
 * disappears the moment you type, which on a form you fill once — onboarding —
 * is exactly when you need it.
 */
export const AtlasField: React.FC<{
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}> = ({ label, hint, children }) => {
  const id = useId();
  return (
    <div className="at-field">
      <label className="at-field-label" htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="at-field-hint">{hint}</span>}
    </div>
  );
};

export const AtlasInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email';
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
}> = ({ label, value, onChange, hint, type = 'text', inputMode, placeholder, suffix, autoFocus }) => (
  <AtlasField label={label} hint={hint}>
    {id => (
      <div className="at-input-wrap">
        <input
          id={id}
          className="at-input"
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="at-input-suffix">{suffix}</span>}
      </div>
    )}
  </AtlasField>
);

export const AtlasTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 4 }) => (
  <AtlasField label={label}>
    {id => (
      <textarea
        id={id}
        className="at-input at-textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    )}
  </AtlasField>
);

export interface AtlasOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * A sliding segmented control — one track, one thumb that moves to the chosen
 * option. For the small closed sets where the options are alternatives to each
 * other (front/back, on/off) rather than a list you scan, which is what
 * `AtlasChoice`'s loose chips are for.
 *
 * The thumb is positioned from two custom properties instead of per-option
 * classes, so it works for any number of options without measuring anything.
 */
export function AtlasSegment<T extends string>({ label, options, value, onChange }: {
  label?: string;
  options: AtlasOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}): React.ReactElement {
  // Falls back to the first option rather than hiding the thumb: a segmented
  // control with nothing selected reads as broken, and every caller here has a
  // value at all times.
  const index = Math.max(0, options.findIndex(option => option.value === value));
  return (
    <div className="at-field">
      {label && <span className="at-field-label">{label}</span>}
      <div
        className="at-seg"
        role="radiogroup"
        aria-label={label}
        style={{ '--at-seg-n': options.length, '--at-seg-i': index } as React.CSSProperties}
      >
        <span className="at-seg-thumb" aria-hidden="true" />
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            data-on={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}{option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A row of chips behaving as one radio group. */
export function AtlasChoice<T extends string>({ label, options, value, onChange }: {
  label?: string;
  options: AtlasOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}): React.ReactElement {
  return (
    <div className="at-field">
      {label && <span className="at-field-label">{label}</span>}
      <div className="at-choice" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className="at-chip"
            data-on={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}{option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
