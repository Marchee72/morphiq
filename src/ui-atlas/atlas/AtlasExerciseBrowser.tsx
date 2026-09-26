import React, { useRef, useState } from 'react';
import { ChevronDown, Clock, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppActions, useAppData } from '../data/useAppData';
import { MUSCLE_GROUPS, type ExerciseSearch } from '../data/useExerciseSearch';
import { MUSCLE_GROUP_LABELS, groupFromExercise } from '../derive/muscleLoad';
import { EXERCISE_EQUIPMENT_LABELS } from '../../data/exercises/exerciseLabels';
import { ExerciseThumb } from '../components/ExerciseThumb';
import type { CatalogItemVM, MuscleGroupId } from '../types';
import { AtlasStates, AtlasSkeleton } from './AtlasStates';
import { AtlasSheet } from './AtlasSheet';

/** How many exercises the "your usual" shelf offers before it stops being a shortcut. */
const USUAL_LIMIT = 12;

/**
 * Searching the catalogue: the body of both the Find tab and the session's
 * exercise picker, so the two cannot drift apart.
 *
 * Search first, then one row of filters: equipment is a single chip that opens
 * a sheet, the body parts follow it. Two labelled rails of chips used to push
 * the list half a screen down before the first exercise showed.
 *
 * Before anything is typed or filtered, "your usual" — favourites and whatever
 * you have logged, most recent first — sits above the catalogue.
 *
 * Results are rows rather than a two-column grid, so a name is read in full and
 * the equipment, the last time and your best fit beside it.
 *
 * The owner holds the search (`useExerciseSearch`) so it can clear it, and
 * decides what choosing an exercise means: adding it, or opening it.
 */
export const AtlasExerciseBrowser: React.FC<{
  search: ExerciseSearch;
  onPick: (item: CatalogItemVM) => void;
  /** The picture's own action. Without one, it does what the row does. */
  onPreview?: (item: CatalogItemVM) => void;
  autoFocus?: boolean;
}> = ({ search, onPick, onPreview, autoFocus = false }) => {
  const { t, tp, fmt } = useT();
  const actions = useAppActions();
  const { catalog } = useAppData();
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const equipmentLabel = (id: string) =>
    EXERCISE_EQUIPMENT_LABELS[id] ? t(EXERCISE_EQUIPMENT_LABELS[id]) : id;

  const meta = (item: CatalogItemVM) => {
    const group = groupFromExercise(catalog.byId(item.id));
    return [
      group && t(MUSCLE_GROUP_LABELS[group]),
      equipmentLabel(item.equipment),
      item.lastUsedAt && fmt.relativeDay(item.lastUsedAt),
    ].filter(Boolean).join(' · ');
  };

  // Recents first, then the favourites never logged. Recents already include
  // the favourites that have been.
  const usual = [...search.recent, ...search.favourites.filter(item => !item.lastUsedAt)].slice(0, USUAL_LIMIT);

  const filtered = search.group !== null || search.equipment !== null;

  const Row: React.FC<{ item: CatalogItemVM }> = ({ item }) => (
    <div className="at-pickrow">
      <button
        className="at-pickrow-img"
        onClick={() => (onPreview ?? onPick)(item)}
        aria-label={`${t('detail.instructions')} · ${item.name}`}
      >
        <ExerciseThumb name={item.name} image={item.image} alt="" />
      </button>
      <button className="at-pickrow-tap" onClick={() => onPick(item)}>
        <b>{item.name}</b>
        <span>{meta(item)}</span>
        {item.bestKg
          ? <i className="at-pickrow-best">{t('picker.best', { weight: `${fmt.upTo(item.bestKg, 1)} ${t('unit.kg')}` })}</i>
          : null}
      </button>
      <button
        className="at-pickrow-fav"
        data-on={item.favorite}
        onClick={() => actions.toggleFavorite(item.id)}
        aria-label={t('picker.favourites')}
        aria-pressed={item.favorite}
      >
        <Heart size={19} fill={item.favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );

  // The chosen group leads the rail, where it can be seen and taken off again;
  // the rail scrolls back so it is actually in view.
  const groups = search.group
    ? [search.group, ...MUSCLE_GROUPS.filter(id => id !== search.group)]
    : MUSCLE_GROUPS;
  const pickGroup = (id: MuscleGroupId) => {
    search.setGroup(search.group === id ? null : id);
    railRef.current?.scrollTo?.({ left: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Pinned while the list scrolls under it: the search and the filters are
          what you reach for after scrolling, not before. */}
      <div className="at-browse-bar">
        <div className="at-searchpill">
          <Search size={17} color="var(--muted)" />
          <input
            value={search.query}
            onChange={e => search.setQuery(e.target.value)}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            autoFocus={autoFocus}
          />
          {search.query && (
            <button className="at-round-sm" onClick={() => search.setQuery('')} aria-label={t('picker.clearSearch')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Equipment stays put; only the body parts scroll sideways. */}
        {search.ready && (
          <div className="at-picker-filters">
            {search.equipment ? (
              <button
                className="at-chip"
                data-solid="true"
                onClick={() => search.setEquipment(null)}
                aria-label={t('picker.removeFilter', { name: equipmentLabel(search.equipment) })}
              >
                <SlidersHorizontal size={14} /> {equipmentLabel(search.equipment)} <X size={13} />
              </button>
            ) : (
              <button className="at-chip" onClick={() => setEquipmentOpen(true)}>
                <SlidersHorizontal size={14} /> {t('picker.equipment')} <ChevronDown size={14} />
              </button>
            )}
            <span className="at-chiprail-sep" aria-hidden="true" />
            <div className="at-chiprail" ref={railRef}>
              {groups.map(id => (
                <button
                  key={id}
                  className="at-chip"
                  data-on={search.group === id}
                  aria-pressed={search.group === id}
                  onClick={() => pickGroup(id)}
                >
                  {t(MUSCLE_GROUP_LABELS[id])}<sup>{search.countForGroup(id)}</sup>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!search.ready ? <AtlasSkeleton /> : (
        <>
          {search.isPristine && usual.length > 0 && (
            <>
              <div className="at-rail-head">
                <h3>{t('picker.usual')}</h3>
                <span className="at-rail-note">{t('picker.usualSub')}</span>
              </div>
              <div className="at-usual">
                {usual.map(item => (
                  <button key={item.id} className="at-usual-card" onClick={() => onPick(item)}>
                    <span className="at-usual-img"><ExerciseThumb name={item.name} image={item.image} alt="" /></span>
                    <b>{item.name}</b>
                    <small>
                      {item.lastUsedAt
                        ? <><Clock size={11} /> {fmt.relativeDay(item.lastUsedAt)}</>
                        : <><Heart size={11} fill="currentColor" /> {t('picker.favourites')}</>}
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="at-rail-head">
            <h3>{search.isPristine ? t('nav.library') : tp('picker.results', search.matchCount)}</h3>
            <button onClick={search.clear}>
              {search.isPristine
                ? t('picker.showing', { shown: search.results.length, total: fmt.n(search.matchCount) })
                : t('picker.clear')}
            </button>
          </div>

          {search.results.length > 0 ? (
            <div className="at-picker-list">
              {search.results.map(item => <Row key={item.id} item={item} />)}
            </div>
          ) : search.query && filtered ? (
            // The filters are the likeliest reason a name you know finds nothing.
            <AtlasStates
              title={t('picker.nothingFor', { q: search.query })}
              body={t('picker.nothingForSub')}
              action={{
                label: t('picker.searchEverywhere'),
                onClick: () => { search.setGroup(null); search.setEquipment(null); },
              }}
            />
          ) : (
            <AtlasStates
              title={search.favouritesOnly ? t('picker.noFavourites') : t('library.empty')}
              body={search.favouritesOnly ? t('picker.noFavouritesSub') : t('library.emptySub')}
              action={{ label: t('picker.clear'), onClick: search.clear }}
            />
          )}
        </>
      )}

      <AtlasSheet open={equipmentOpen} onClose={() => setEquipmentOpen(false)} title={t('picker.equipment')}>
        <div className="at-picker-options">
          {search.equipmentFacets.map(facet => (
            <button
              key={facet.id}
              className="at-picker-option"
              onClick={() => { search.setEquipment(facet.id); setEquipmentOpen(false); }}
            >
              <span>{equipmentLabel(facet.id)}</span>
              <small>{fmt.n(facet.count)}</small>
            </button>
          ))}
        </div>
      </AtlasSheet>
    </>
  );
};
