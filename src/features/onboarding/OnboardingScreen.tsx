import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '../../i18n';
import { AtlasInput, AtlasChoice, AtlasField } from '../../ui-atlas/atlas/AtlasField';
import { AppMark } from '../../ui-atlas/atlas/AppMark';
import { GoogleButton } from '../../ui-atlas/atlas/GoogleButton';
import { useStore } from '../../presentation/state/store';
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM, parseHeightCm } from '../../core/entities/UserProfile';

/**
 * The first screen a new user ever sees, in Atlas's language.
 *
 * It sits outside the app shell — there is no profile yet, so there is nothing
 * for the shell's data provider to load — but it renders inside an `.at`
 * wrapper so the palette, fonts and controls are the same ones the rest of the
 * app uses. The previous version was 54 lines of inline styles that shared
 * nothing with anything.
 */
export const OnboardingScreen: React.FC = () => {
  const { createProfile, loadProfiles } = useStore();
  const { t } = useT();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | undefined>(undefined);
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared with the profile editor rather than re-stated here: the two used to
  // carry their own copies of the same bounds, free to drift apart.
  const heightCm = parseHeightCm(height);
  const ready = Boolean(name.trim() && gender && birthDate && heightCm !== null);

  const submit = async () => {
    // `heightCm` explicitly, not via `ready`: the compiler cannot narrow a
    // `number | null` through a boolean computed elsewhere.
    if (!ready || !gender || heightCm === null) return;
    setLoading(true);
    setError(null);
    try {
      await createProfile({
        name: name.trim(),
        gender,
        birthDate: new Date(birthDate),
        height: heightCm,
      });
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError(err instanceof Error ? err.message : t('onboarding.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app at at-onboard" data-mode="light">
      <div className="at-onboard-inner">
        <div className="at-onboard-head">
          <AppMark size={64} />
          <h1 className="at-serif">{t('onboarding.title')}</h1>
          <p>{t('onboarding.subtitle')}</p>
        </div>

        <div className="at-card at-onboard-form" style={{ marginBottom: 14 }}>
          {/* Signing in first means the profile is created already owned, and
              any history that predates accounts is claimed in the same step. */}
          <GoogleButton onSignedIn={() => { loadProfiles(); }} />
          <span className="at-onboard-divider">{t('auth.or')}</span>
        </div>

        <form
          className="at-card at-onboard-form"
          onSubmit={e => { e.preventDefault(); submit(); }}
        >
          {error && <div className="at-onboard-error">{error}</div>}

          <AtlasInput
            label={t('onboarding.name')}
            value={name}
            onChange={setName}
            placeholder={t('onboarding.namePlaceholder')}
            autoFocus
          />

          <AtlasChoice
            label={t('onboarding.gender')}
            value={gender}
            onChange={setGender}
            options={[
              { value: 'male', label: t('onboarding.male') },
              { value: 'female', label: t('onboarding.female') },
            ]}
          />

          <AtlasField label={t('onboarding.birthDate')}>
            {id => (
              <input
                id={id}
                className="at-input"
                type="date"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setBirthDate(e.target.value)}
              />
            )}
          </AtlasField>

          <AtlasInput
            label={t('onboarding.height')}
            value={height}
            onChange={setHeight}
            inputMode="numeric"
            placeholder="178"
            suffix={t('onboarding.cm')}
            hint={height && heightCm === null ? t('onboarding.heightRange', { min: MIN_HEIGHT_CM, max: MAX_HEIGHT_CM }) : undefined}
          />

          <button className="at-btn" type="submit" disabled={!ready || loading} style={{ justifyContent: 'center', marginTop: 4 }}>
            {loading ? t('onboarding.creating') : t('onboarding.create')}
            {!loading && <i><ArrowRight size={16} /></i>}
          </button>
        </form>

        <p className="at-onboard-note">{t('onboarding.why')}</p>
      </div>
    </div>
  );
};
