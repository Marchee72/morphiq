import React, { useState } from 'react';
import { Check, Database, Dumbbell, Monitor, Moon, RefreshCw, Sun, Trash2, X } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { useT } from '../../i18n';
import { CapacitorHealthProvider } from '../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../data/health/WebHealthProvider';
import { ALL_EQUIPMENT } from '../../features/settings/gymEquipmentData';
import { LANGUAGES, MODES } from '../../presentation/state/preferences';
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM, parseHeightCm } from '../../core/entities/UserProfile';
import { AtlasSheet } from './AtlasSheet';
import { AtlasInput, AtlasChoice } from './AtlasField';
import { AppMark } from './AppMark';
import { AtlasInstallCard } from './AtlasInstallCard';
import { GoogleButton } from './GoogleButton';
import { getUser } from '../../data/auth/session';
import { signOut, isGoogleConfigured } from '../../data/auth/googleSignIn';

type Panel = 'profile' | 'equipment' | 'data' | null;

/**
 * Settings, rebuilt in Atlas.
 *
 * The three separate legacy sheets (profile edit, equipment, backup) collapse
 * into one sheet that swaps its contents — three near-identical files existed
 * only because each was written against the old `Sheet` primitive.
 */
export const AtlasSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, fmt } = useT();
  const {
    profiles, activeProfile, setActiveProfile, updateProfile,
    theme, setTheme, language, setLanguage,
    exportBackupData, importBackupData, clearDatabaseData,
    seedMockData, clearMockData, importWorkouts, importMeasurements,
  } = useStore();

  const [panel, setPanel] = useState<Panel>(null);
  const [account, setAccount] = useState(getUser());
  const [status, setStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const syncHealth = async () => {
    if (!activeProfile) return;
    setSyncing(true);
    setStatus(t('settings.syncing'));
    try {
      const capacitor = new CapacitorHealthProvider();
      const provider = capacitor.isAvailable() ? capacitor : new WebHealthProvider();
      if (!(await provider.requestPermissions())) {
        setStatus(t('settings.syncDenied'));
        return;
      }
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const workouts = await provider.importWorkouts(since);
      if (provider.importBodyComposition) {
        const measurements = await provider.importBodyComposition(since, activeProfile);
        if (measurements.length > 0) await importMeasurements(measurements);
      }
      await importWorkouts(workouts);
      setStatus(t('settings.syncOk', { n: workouts.length }));
    } catch (err) {
      console.error('Health sync error:', err);
      setStatus(t('settings.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="at-settings">
      <div className="at-editor-head">
        <div>
          <small>MorphIQ</small>
          <h3 className="at-serif">{t('settings.title')}</h3>
        </div>
        <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <div className="at-pad at-settings-body">
        {/* Profile */}
        <div className="at-card">
          <div className="at-settings-row">
            <div>
              <span className="at-field-label">{t('settings.profile')}</span>
              <b className="at-settings-name">{activeProfile?.name ?? t('settings.noProfile')}</b>
              {activeProfile && (
                <small>
                  {activeProfile.height} cm
                  {activeProfile.targetWeight ? ` · ${fmt.n(activeProfile.targetWeight, 1)} ${t('unit.kg')}` : ''}
                </small>
              )}
            </div>
            <button className="at-btn" data-ghost="true" onClick={() => setPanel('profile')}>
              {t('settings.edit')}
            </button>
          </div>

          {profiles.length > 1 && (
            <div className="at-settings-profiles">
              <span className="at-field-label">{t('settings.switchProfile')}</span>
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  className="at-routine-item"
                  onClick={() => profile.id && setActiveProfile(profile.id)}
                >
                  <span>{profile.name}<small>{profile.height} cm</small></span>
                  {activeProfile?.id === profile.id && <b><Check size={16} /></b>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Install to the home screen. Above the account block on purpose: on
            the web it is the first thing someone arriving from a shared link
            wants, and it disappears entirely once taken up. */}
        <AtlasInstallCard />

        {/* Account */}
        {isGoogleConfigured() && (
          <div className="at-card at-settings-stack">
            <span className="at-field-label">{t('auth.account')}</span>
            {account ? (
              <>
                <div className="at-account">
                  {account.picture && <img src={account.picture} alt="" referrerPolicy="no-referrer" />}
                  <div>
                    <b>{account.name ?? '—'}</b>
                    <small>{account.email ?? ''}</small>
                  </div>
                </div>
                <button
                  className="at-btn"
                  data-ghost="true"
                  style={{ justifyContent: 'center' }}
                  onClick={async () => { await signOut(); setAccount(null); }}
                >
                  {t('auth.signOut')}
                </button>
              </>
            ) : (
              <>
                <small className="at-field-hint">{t('auth.notSignedInSub')}</small>
                <GoogleButton onSignedIn={() => setAccount(getUser())} />
                <small className="at-field-hint">{t('auth.why')}</small>
              </>
            )}
          </div>
        )}

        {/* Appearance */}
        <div className="at-card at-settings-stack">
          <AtlasChoice
            label={t('settings.mode')}
            value={theme}
            onChange={setTheme}
            options={MODES.map(mode => ({
              value: mode,
              label: t(`settings.mode.${mode}`),
              icon: mode === 'system' ? <Monitor size={14} /> : mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />,
            }))}
          />
          <AtlasChoice
            label={t('settings.language')}
            value={language}
            onChange={setLanguage}
            options={LANGUAGES.map(lang => ({ value: lang, label: t(`settings.language.${lang}`) }))}
          />
        </div>

        {/* Health */}
        <div className="at-card at-settings-stack">
          <div>
            <span className="at-field-label">{t('settings.health')}</span>
            <small className="at-field-hint">{t('settings.healthSub')}</small>
          </div>
          <button className="at-btn" onClick={syncHealth} disabled={syncing} style={{ justifyContent: 'center' }}>
            <RefreshCw size={15} /> {syncing ? t('settings.syncing') : t('settings.syncNow')}
          </button>
          {status && <span className="at-settings-status">{status}</span>}
        </div>

        {/* Equipment */}
        <button className="at-card at-settings-row at-settings-tap" onClick={() => setPanel('equipment')}>
          <div>
            <span className="at-field-label">{t('settings.equipment')}</span>
            <small>
              {activeProfile?.availableEquipment?.length
                ? `${activeProfile.availableEquipment.length} / ${ALL_EQUIPMENT.length}`
                : t('settings.equipmentSub')}
            </small>
          </div>
          <span className="at-settings-icon"><Dumbbell size={17} /></span>
        </button>

        {/* Data */}
        <button className="at-card at-settings-row at-settings-tap" onClick={() => setPanel('data')}>
          <div>
            <span className="at-field-label">{t('settings.data')}</span>
            <small>{t('settings.backup')}</small>
          </div>
          <span className="at-settings-icon"><Database size={17} /></span>
        </button>

        <div className="at-settings-mark">
          <AppMark size={40} />
          <small>MorphIQ</small>
        </div>
      </div>

      <ProfilePanel open={panel === 'profile'} onClose={() => setPanel(null)} />
      <EquipmentPanel open={panel === 'equipment'} onClose={() => setPanel(null)} />
      <DataPanel
        open={panel === 'data'}
        onClose={() => setPanel(null)}
        onExport={exportBackupData}
        onImport={importBackupData}
        onClear={clearDatabaseData}
        onSeed={seedMockData}
        onClearDemo={clearMockData}
      />
    </div>
  );

  function ProfilePanel({ open, onClose: close }: { open: boolean; onClose: () => void }) {
    const [name, setName] = useState(activeProfile?.name ?? '');
    const [height, setHeight] = useState(activeProfile?.height?.toString() ?? '');
    const [targetWeight, setTargetWeight] = useState(activeProfile?.targetWeight?.toString() ?? '');
    const [goalDays, setGoalDays] = useState(activeProfile?.weeklyWorkoutGoalDays?.toString() ?? '4');

    /**
     * Height was displayed on the settings card and editable nowhere — once
     * onboarding was past, a typo in it was permanent, and it feeds every
     * body-composition figure the app derives.
     */
    const heightCm = parseHeightCm(height);

    const save = async () => {
      if (!activeProfile || heightCm === null) return;
      await updateProfile({
        ...activeProfile,
        name: name.trim() || activeProfile.name,
        height: heightCm,
        targetWeight: Number(targetWeight) || undefined,
        weeklyWorkoutGoalDays: Number(goalDays) || undefined,
      });
      close();
    };

    return (
      <AtlasSheet
        open={open}
        onClose={close}
        title={t('settings.edit')}
        subtitle={t('settings.profile')}
        footer={
          <button className="at-btn" onClick={save} disabled={heightCm === null}>
            {t('settings.save')}
          </button>
        }
      >
        <AtlasInput label={t('onboarding.name')} value={name} onChange={setName} />
        <AtlasInput
          label={t('onboarding.height')}
          value={height}
          onChange={setHeight}
          inputMode="decimal"
          suffix="cm"
          // Shown only when it is wrong, so the rule appears when it is needed
          // rather than as permanent noise under a field that is usually fine.
          hint={height && heightCm === null
            ? t('onboarding.heightRange', { min: MIN_HEIGHT_CM, max: MAX_HEIGHT_CM })
            : undefined}
        />
        <AtlasInput label={t('settings.targetWeight')} value={targetWeight} onChange={setTargetWeight} inputMode="decimal" suffix={t('unit.kg')} />
        <AtlasInput label={t('settings.weeklyGoal')} value={goalDays} onChange={setGoalDays} inputMode="numeric" />
      </AtlasSheet>
    );
  }

  function EquipmentPanel({ open, onClose: close }: { open: boolean; onClose: () => void }) {
    const [selected, setSelected] = useState<string[]>(activeProfile?.availableEquipment ?? []);

    const save = async () => {
      if (!activeProfile) return;
      await updateProfile({ ...activeProfile, availableEquipment: selected });
      close();
    };

    return (
      <AtlasSheet
        open={open}
        onClose={close}
        title={t('settings.equipment')}
        subtitle={t('settings.equipmentSub')}
        footer={<button className="at-btn" onClick={save}>{t('settings.save')}</button>}
      >
        <div className="at-choice">
          {ALL_EQUIPMENT.map(item => {
            const on = selected.includes(item.id);
            return (
              <button
                key={item.id}
                className="at-chip"
                data-on={on}
                aria-pressed={on}
                onClick={() => setSelected(prev => on ? prev.filter(i => i !== item.id) : [...prev, item.id])}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </AtlasSheet>
    );
  }

  function DataPanel({ open, onClose: close, onExport, onImport, onClear, onSeed, onClearDemo }: {
    open: boolean;
    onClose: () => void;
    onExport: () => Promise<string>;
    onImport: (json: string) => Promise<boolean>;
    onClear: () => Promise<void>;
    onSeed: () => Promise<void>;
    onClearDemo: () => Promise<void>;
  }) {
    const [message, setMessage] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    const download = async () => {
      const json = await onExport();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `morphiq-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(t('settings.exported'));
    };

    const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const ok = await onImport(String(reader.result));
        setMessage(ok ? t('settings.imported') : t('settings.importError'));
      };
      reader.readAsText(file);
    };

    return (
      <AtlasSheet open={open} onClose={close} title={t('settings.data')}>
        <button className="at-btn" data-ghost="true" onClick={download} style={{ justifyContent: 'center' }}>
          {t('settings.export')}
        </button>

        <label className="at-btn" data-ghost="true" style={{ justifyContent: 'center', cursor: 'pointer' }}>
          {t('settings.import')}
          <input type="file" accept=".json" onChange={upload} style={{ display: 'none' }} />
        </label>

        <div className="at-field">
          <span className="at-field-label">{t('settings.demoLabel')}</span>
          <div className="at-choice">
            <button className="at-chip" onClick={async () => { setMessage(t('settings.demoLoading')); await onSeed(); setMessage(t('settings.demoLoaded')); }}>
              {t('settings.demoLoad')}
            </button>
            <button className="at-chip" onClick={async () => { await onClearDemo(); setMessage(t('settings.demoCleared')); }}>
              {t('settings.demoClear')}
            </button>
          </div>
        </div>

        {/* Destructive, so it asks first and never sits next to a save button. */}
        <div className="at-danger">
          <div>
            <b><Trash2 size={14} /> {t('settings.reset')}</b>
            <small>{t('settings.resetSub')}</small>
          </div>
          {confirming ? (
            <>
              <p>{t('settings.resetConfirm')}</p>
              <div className="at-choice">
                <button className="at-chip" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
                <button className="at-chip" data-danger="true" onClick={async () => { await onClear(); setConfirming(false); close(); }}>
                  {t('common.delete')}
                </button>
              </div>
            </>
          ) : (
            <button className="at-chip" data-danger="true" onClick={() => setConfirming(true)}>
              {t('settings.reset')}
            </button>
          )}
        </div>

        {message && <span className="at-settings-status">{message}</span>}
      </AtlasSheet>
    );
  }
};
