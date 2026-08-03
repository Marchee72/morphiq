import React from 'react';
import { Heart, Info, Search, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppActions, useAppData } from '../data/useAppData';
import { useExerciseSearch, MUSCLE_GROUPS } from '../data/useExerciseSearch';
import { MUSCLE_GROUP_LABELS } from '../derive/muscleLoad';
import { EXERCISE_EQUIPMENT_LABELS } from '../../data/exercises/exerciseLabels';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { useDismissOnBack } from '../components/useDismissOnBack';
import type { CatalogItemVM } from '../types';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasStates, AtlasSkeleton } from './AtlasStates';

/**
 * Add an exercise to the running session.
 *
 * Favourites sit above everything while no filter is active — mid-session you
 * almost always want something you already do. Body part and equipment are the
 * two filters that actually narrow 1,324 entries to a usable list, and they are
 * the same two the Library uses, so the two surfaces behave identically.
 */
export const AtlasExercisePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: { id?: string; name: string }) => void;
  /** Replacing an exercise rather than adding one — changes the heading only. */
  swapping?: boolean;
  /** Opens the detail sheet without leaving the picker. */
  onPreview?: (exercise: Exercise) => void;
}> = ({ open, onClose, swapping = false, onSelect, onPreview }) => {
  const { t, fmt } = useT();
  const actions = useAppActions();
  const { catalog } = useAppData();
  const search = useExerciseSearch();

  useDismissOnBack(open, onClose, 'picker');

  if (!open) return null;

  const pick = (item: CatalogItemVM) => onSelect({ id: item.id, name: item.name });

  const Card: React.FC<{ item: CatalogItemVM }> = ({ item }) => (
    <div className="at-ex">
      <button className="at-ex-tap" onClick={() => pick(item)}>
        <span className="at-ex-img">
          <ExerciseThumb name={item.name} image={item.image} />
        </span>
        <span className="at-ex-body">
          <b>{item.name}</b>
          <span>
            {EXERCISE_EQUIPMENT_LABELS[item.equipment] ? t(EXERCISE_EQUIPMENT_LABELS[item.equipment]) : item.equipment}
            {item.bestKg ? ` · ${fmt.n(item.bestKg, 1)} ${t('unit.kg')}` : ''}
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
      {onPreview && (
        <button
          className="at-ex-info"
          onClick={() => { const ex = catalog.byId(item.id); if (ex) onPreview(ex); }}
          aria-label={t('detail.instructions')}
        >
          <Info size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="at-picker" role="dialog" aria-label={t('picker.title')}>
      <div className="at-editor-head">
        <div>
          <small>{swapping ? t('picker.swapSubtitle') : t('picker.subtitle')}</small>
          <h3 className="at-serif">{swapping ? t('train.swap') : t('picker.title')}</h3>
        </div>
        <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <div className="at-searchpill">
        <Search size={17} color="var(--muted)" />
        <input
          value={search.query}
          onChange={e => search.setQuery(e.target.value)}
          placeholder={t('library.search')}
          aria-label={t('library.search')}
          autoFocus
        />
      </div>

      {!search.ready ? <AtlasSkeleton /> : (
        <>
          <div className="at-filter-label">{t('picker.bodyPart')}</div>
          <div className="at-chiprail">
            <button className="at-chip" data-on={search.group === null} onClick={() => search.setGroup(null)}>
              {t('picker.anyBodyPart')}
            </button>
            {MUSCLE_GROUPS.map(id => (
              <button
                key={id}
                className="at-chip"
                data-on={search.group === id}
                onClick={() => search.setGroup(search.group === id ? null : id)}
              >
                {t(MUSCLE_GROUP_LABELS[id])}<sup>{search.countForGroup(id)}</sup>
              </button>
            ))}
          </div>

          <div className="at-filter-label">{t('picker.equipment')}</div>
          <div className="at-chiprail">
            <button className="at-chip" data-on={search.equipment === null} onClick={() => search.setEquipment(null)}>
              {t('picker.anyEquipment')}
            </button>
            {search.equipmentFacets.slice(0, 10).map(facet => (
              <button
                key={facet.id}
                className="at-chip"
                data-on={search.equipment === facet.id}
                onClick={() => search.setEquipment(search.equipment === facet.id ? null : facet.id)}
              >
                {EXERCISE_EQUIPMENT_LABELS[facet.id] ? t(EXERCISE_EQUIPMENT_LABELS[facet.id]) : facet.id}<sup>{facet.count}</sup>
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
            <div className="at-grid" style={{ paddingBottom: 28 }}>
              {search.results.map(item => <Card key={item.id} item={item} />)}
            </div>
          ) : (
            <AtlasStates
              title={search.favouritesOnly ? t('picker.noFavourites') : t('library.empty')}
              body={search.favouritesOnly ? t('picker.noFavouritesSub') : t('library.emptySub')}
              action={{ label: t('picker.clear'), onClick: search.clear }}
            />
          )}
        </>
      )}
      <div style={{ height: 20 }} />
    </div>
  );
};
