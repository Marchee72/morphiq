import React, { useState } from 'react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { useExerciseSearch } from '../data/useExerciseSearch';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasSkeleton } from './AtlasStates';
import { AtlasExerciseDetail } from './AtlasExerciseDetail';
import { AtlasExerciseBrowser } from './AtlasExerciseBrowser';

/**
 * Find — the whole catalogue, searched the same way the session's picker
 * searches it (`AtlasExerciseBrowser`), so the two surfaces behave identically.
 *
 * Choosing an exercise here opens it: how it is performed, and every session
 * you have done it. Mid-session, the sheet it opens is also the way to add it.
 */
export const AtlasLibrary: React.FC = () => {
  const { catalog } = useAppData();
  const search = useExerciseSearch();
  const { t, fmt } = useT();
  const [detail, setDetail] = useState<Exercise | null>(null);

  if (!search.ready) return <AtlasSkeleton shape="library" />;

  return (
    <>
      <div className="at-greet" style={{ paddingBottom: 8 }}>
        <div>
          <small>{t('library.total', { n: fmt.n(search.total) })}</small>
          <h1>{t('library.heading')}</h1>
        </div>
      </div>

      <AtlasExerciseBrowser
        search={search}
        onPick={item => { const ex = catalog.byId(item.id); if (ex) setDetail(ex); }}
      />

      {/* Clears the floating dock, which the list otherwise ends underneath. */}
      <div style={{ height: 96 }} />

      <AtlasExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
    </>
  );
};
