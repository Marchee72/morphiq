import { useCallback, useState } from 'react';
import { useStore } from '../../presentation/state/store';
import { useT } from '../../i18n';
import { CapacitorHealthProvider } from '../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../data/health/WebHealthProvider';
import { HEALTH_IMPORT_DAYS } from '../derive/bodyMetrics';
import { syncSince } from '../../data/health/syncWindow';

/** What a finished sync amounts to, for whoever asked for it. */
export interface HealthSyncResult {
  ok: boolean;
  /** Workouts written. Zero is a real answer — there may simply be none new. */
  workouts: number;
  /** Already translated: the caller shows it, it does not interpret it. */
  message: string;
}

/**
 * Pulling from Health Connect, which is where Samsung Health leaves its data.
 *
 * There is no Samsung SDK involved and there does not need to be: Samsung Health
 * writes workouts, weight and body composition into Health Connect, and
 * `capacitor-health` reads Health Connect. Anything else on the phone that
 * writes there — the watch, a scale's own app — arrives by the same door.
 *
 * Lifted out of `AtlasSettings`, which owned this as a private function, once
 * the pull gesture needed to run exactly the same import. Two copies of an
 * importer is two things to keep agreeing about how far back to reach.
 */
export function useHealthSync() {
  const { t } = useT();
  const activeProfile = useStore(s => s.activeProfile);
  const importWorkouts = useStore(s => s.importWorkouts);
  const importMeasurements = useStore(s => s.importMeasurements);

  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sync = useCallback(async (): Promise<HealthSyncResult> => {
    if (!activeProfile) return { ok: false, workouts: 0, message: '' };

    setSyncing(true);
    setStatus(t('settings.syncing'));

    const finish = (result: HealthSyncResult) => {
      setStatus(result.message);
      setSyncing(false);
      return result;
    };

    try {
      const capacitor = new CapacitorHealthProvider();
      const provider = capacitor.isAvailable() ? capacitor : new WebHealthProvider();
      if (!(await provider.requestPermissions())) {
        return finish({ ok: false, workouts: 0, message: t('settings.syncDenied') });
      }

      // The same windows as the automatic sync in `App.tsx`, stretched back to
      // the last clean sync after a gap. Only that sync moves the checkpoint: it
      // is the one that also imports wellness.
      const profileId = String(activeProfile.id);
      const workouts = await provider.importWorkouts(syncSince(profileId, 30));

      if (provider.importBodyComposition) {
        // Reaches back further than the workouts do: the Body charts cover
        // 12 weeks, and a 30-day import leaves two thirds of every chart
        // filled by gap-filling over readings Health Connect already holds.
        const measurements = await provider.importBodyComposition(
          syncSince(profileId, HEALTH_IMPORT_DAYS), activeProfile);
        if (measurements.length > 0) await importMeasurements(measurements);
      }

      await importWorkouts(workouts);
      return finish({
        ok: true,
        workouts: workouts.length,
        message: t('settings.syncOk', { n: workouts.length }),
      });
    } catch (err) {
      console.error('Health sync error:', err);
      return finish({ ok: false, workouts: 0, message: t('settings.syncError') });
    }
  }, [activeProfile, importMeasurements, importWorkouts, t]);

  return { sync, syncing, status, setStatus };
}
