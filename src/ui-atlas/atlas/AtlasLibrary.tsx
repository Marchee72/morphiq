import React, { useState } from 'react';
import { Heart, Search } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useExerciseSearch } from '../data/useExerciseSearch';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { MUSCLE_GROUP_LABELS } from '../derive/muscleLoad';
import type { CatalogItemVM } from '../types';
import { BodyMap, type Side } from './BodyMap';
import { AtlasStates, AtlasSkeleton } from './AtlasStates';

/**
 * Library — the body map is the way in, text search stays secondary.
 *
 * For someone who thinks in muscles rather than exercise names, which is the
 * concept's stated audience. Results are capped rather than paginated: the map
 * plus an equipment filter narrows 1,324 exercises far enough that a scroll is
 * shorter than a pager.
 */
export const AtlasLibrary: React.FC = () => {
  const { training } = useAppData();
  const actions = useAppActions();
  const search = useExerciseSearch();
  const { t, fmt } = useT();

  const [side, setSide] = useState<Side>('front');

  const setsThisWeek = training.muscleLoad.rows.find(r => r.group === search.group)?.sets ?? 0;

  const Card: React.FC<{ item: CatalogItemVM }> = ({ item }) => (
    <div className="at-ex">
      <button className="at-ex-tap" onClick={() => actions.toggleFavorite(item.id)}>
        <span className="at-ex-img">
          <ExerciseThumb name={item.name} image={item.image} />
        </span>
        <span className="at-ex-body">
          <b>{item.name}</b>
          <span>
            {item.equipment}
            {item.bestKg ? ` · ${t('library.best').toLowerCase()} ${fmt.n(item.bestKg, 1)} ${t('unit.kg')}` : ''}
          </span>
        </span>
      </button>
      <button
        className="at-ex-fav"
        data-on={item.favorite}
        onClick={() => actions.toggleFavorite(item.id)}
        aria-label={t('picker.favourites')}
        aria-pressed={item.favorite}
      >
        <Heart size={13} fill={item.favorite ? 'var(--clay)' : 'none'} />
      </button>
    </div>
  );

  if (!search.ready) return <AtlasSkeleton />;

  return (
    <>
      <div className="at-greet" style={{ paddingBottom: 8 }}>
        <div>
          <small>{t('library.total', { n: fmt.n(search.total) })}</small>
          <h1>{t('library.heading')}</h1>
        </div>
      </div>

      <div className="at-searchpill">
        <Search size={17} color="var(--muted)" />
        <input
          value={search.query}
          onChange={e => search.setQuery(e.target.value)}
          placeholder={t('library.search')}
          aria-label={t('library.search')}
        />
      </div>

      <div className="at-map">
        <figure>
          <BodyMap side={side} active={search.group} onPick={search.setGroup} />
        </figure>
        <div className="at-map-legend">
          <h4>{search.group ? t(MUSCLE_GROUP_LABELS[search.group]) : t('library.tapMuscle')}</h4>
          <p>
            {search.group
              ? t('library.regionSummary', { count: fmt.n(search.countForGroup(search.group)), sets: setsThisWeek })
              : t('library.tapMuscleSub')}
          </p>
          <div className="at-map-side">
            <button data-on={side === 'front'} onClick={() => { setSide('front'); search.setGroup('chest'); }}>
              {t('library.front')}
            </button>
            {/* Switching side re-picks a region that exists on that side. */}
            <button data-on={side === 'back'} onClick={() => { setSide('back'); search.setGroup('back'); }}>
              {t('library.back')}
            </button>
          </div>
        </div>
      </div>

      <div className="at-chiprail">
        <button className="at-chip" data-on={search.equipment === null} onClick={() => search.setEquipment(null)}>
          {t('library.anyKit')}
        </button>
        {search.equipmentFacets.slice(0, 10).map(facet => (
          <button
            key={facet.id}
            className="at-chip"
            data-on={search.equipment === facet.id}
            onClick={() => search.setEquipment(search.equipment === facet.id ? null : facet.id)}
          >
            {facet.id}<sup>{facet.count}</sup>
          </button>
        ))}
      </div>

      {search.isPristine && search.favourites.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3><Heart size={14} fill="var(--clay)" color="var(--clay)" /> {t('picker.favourites')}</h3>
          </div>
          <div className="at-grid">
            {search.favourites.map(item => <Card key={`fav-${item.id}`} item={item} />)}
          </div>
        </>
      )}

      <div className="at-rail-head">
        <h3>{t('nav.library')}</h3>
        <button onClick={search.clear}>
          {search.isPristine
            ? t('picker.showing', { shown: search.results.length, total: fmt.n(search.matchCount) })
            : t('picker.clear')}
        </button>
      </div>

      {search.results.length > 0 ? (
        <div className="at-grid">
          {search.results.map(item => <Card key={item.id} item={item} />)}
        </div>
      ) : (
        <AtlasStates title={t('library.empty')} body={t('library.emptySub')} />
      )}

      <div style={{ height: 20 }} />
    </>
  );
};
