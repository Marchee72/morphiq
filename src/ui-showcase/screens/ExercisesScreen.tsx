import React, { useState, useRef, useCallback } from 'react';
import { Search, Dumbbell, ChevronRight } from 'lucide-react';
import type { ThemeId, ExerciseItem } from '../types';
import { INITIAL_EXERCISES } from '../mockData';

interface Props {
  themeId: ThemeId;
  onSelectExercise: (ex: ExerciseItem) => void;
  onAddExerciseClick: () => void;
}

const categoryEmojiMap: Record<string, string> = {
  Chest: '\u{1F4AA}',
  Back: '\u{1F985}',
  Legs: '\u{1F9B5}',
  Shoulders: '\u{1F3CB}',
  Hamstrings: '\u{1F9B5}',
  Arms: '\u{1F9BE}',
  Core: '\u{1F3AF}',
};

const difficultyBadge: Record<ExerciseItem['difficulty'], string> = {
  Beginner: '\u{1F331} Beginner',
  Intermediate: '\u{2B50} Intermediate',
  Advanced: '\u{1F525} Advanced',
};

const mockUsageProgress: Record<string, number> = {
  '1': 78, '2': 62, '3': 91, '4': 28, '5': 45,
  '6': 55, '7': 83, '8': 74, '9': 37, '10': 14,
};

const favoriteIds = new Set(['1', '3', '6']);

export const ExercisesScreen: React.FC<Props> = ({ themeId, onSelectExercise, onAddExerciseClick }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invertedId, setInvertedId] = useState<string | null>(null);
  const [targetedId, setTargetedId] = useState<string | null>(null);

  // Long-press timer ref for Tactical Amber theme (must be at top level per React rules)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback((id: string) => {
    longPressTimer.current = setTimeout(() => {
      setTargetedId(prev => prev === id ? null : id);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

  const filtered = INITIAL_EXERCISES.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || ex.muscle.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /* ========================================================================
     THEME 1: CLAY INDIGO — TICKET-STUB CARDS
     Perforated left edge (dotted border-left), dotted divider between name
     and muscle/equipment info, chevron on right, horizontal pill rail.
     ======================================================================== */
  if (themeId === 'clay-indigo') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#ffb562', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>TICKET LIBRARY</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '2px 0 0 0' }}>Exercises ({filtered.length})</h2>
          </div>
          <button
            onClick={onAddExerciseClick}
            style={{ background: '#fce1b4', color: '#2b2754', border: 'none', padding: '8px 14px', borderRadius: '18px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
          >
            + New
          </button>
        </div>

        <div className="clay-recessed-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} color="#ffb562" />
          <input
            type="text"
            placeholder="Search movement or muscle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? '#fce1b4' : '#211e40',
                color: selectedCategory === cat ? '#2b2754' : '#c4bddc',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(ex => (
            <div
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              style={{
                background: '#393369',
                borderRadius: '24px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                borderLeft: '3px dotted rgba(255,181,98,0.5)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <div className="clay-avatar-bubble" style={{ width: '38px', height: '38px', flexShrink: 0 }}>
                  <Dumbbell size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                  <div style={{ borderTop: '1px dotted rgba(255,181,98,0.35)', margin: '4px 0', width: '60%' }} />
                  <div style={{ fontSize: '11px', color: '#ffb562', fontWeight: 700 }}>{ex.muscle} · {ex.equipment}</div>
                </div>
              </div>
              <ChevronRight size={18} color="#fce1b4" style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 2: WARM LATTE — MAGAZINE INDEX
     Numbered list (serif), category as small-caps eyebrow, exercise names
     in serif, thin rules between entries, "departments" filter row. No cards.
     ======================================================================== */
  if (themeId === 'warm-latte') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#c4a88c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>ISSUE No. 04 · CATALOGUE</span>
            <h2 className="latte-hero-serif" style={{ fontSize: '28px', margin: '4px 0 0 0', color: '#f7f1e3' }}>The Exercise<br />Index</h2>
          </div>
          <button onClick={onAddExerciseClick} className="latte-attached-pill-btn" style={{ padding: '8px 14px', fontSize: '11px' }}>
            + ADD CUSTOM
          </button>
        </div>

        <div style={{ background: '#e8dfce', borderRadius: '20px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} color="#7a5839" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#3e2a1b', fontSize: '13px', outline: 'none', width: '100%', fontWeight: 700 }}
          />
        </div>

        {/* Departments row — small-caps filter chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? '#3e2a1b' : 'transparent',
                color: selectedCategory === cat ? '#e8dfce' : '#c4a88c',
                border: selectedCategory === cat ? '1px solid #3e2a1b' : '1px solid #c4a88c',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat === 'All' ? 'ALL DEPTS' : cat}
            </button>
          ))}
        </div>

        <div className="latte-bottom-sheet" style={{ borderRadius: '24px', padding: '20px 16px', display: 'flex', flexDirection: 'column' }}>
          {filtered.map((ex, idx) => (
            <div key={ex.id}>
              <div
                onClick={() => onSelectExercise(ex)}
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 0', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, fontFamily: "'Playfair Display', serif", color: '#7a5839', lineHeight: 1, minWidth: '32px' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#a08060', marginBottom: '2px', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {ex.category}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#3e2a1b', fontFamily: "'Playfair Display', serif" }}>{ex.name}</div>
                    <div style={{ fontSize: '11px', color: '#7a5839', marginTop: '2px', fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>
                      {ex.muscle} · {ex.equipment}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="#8c6645" style={{ flexShrink: 0, marginTop: '4px' }} />
              </div>
              {idx < filtered.length - 1 && (
                <hr style={{ border: 'none', borderTop: '1px solid #d4c5b0', margin: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 3: ULTRA STEALTH DARK — DOT-MATRIX TABLE
     Tight grid table with dot clusters for category/equipment, search with
     border-bottom animation (blinking caret), tapping expands inline.
     ======================================================================== */
  if (themeId === 'dark-stealth') {
    const categoryDotIndex: Record<string, number> = { Chest: 1, Back: 2, Legs: 3, Shoulders: 1, Hamstrings: 2, Arms: 3, Core: 1 };
    const equipmentDotIndex: Record<string, number> = { Barbell: 3, Dumbbells: 2, Cable: 1, Bodyweight: 1 };

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="stealth-title-huge" style={{ fontSize: '28px', margin: 0 }}>Library</h1>
          <button onClick={onAddExerciseClick} style={{ background: '#18181c', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            + Add
          </button>
        </div>

        {/* Search with border-bottom that transitions on focus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: search ? '1px solid #ffffff' : '1px solid #2a2a34', transition: 'border-bottom-color 0.3s ease' }}>
          <Search size={16} color="#888894" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '13px',
              outline: 'none',
              width: '100%',
              caretColor: '#ffffff',
            }}
          />
        </div>

        {/* Dot-matrix table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {filtered.map(ex => {
            const isExpanded = expandedId === ex.id;
            const catDots = categoryDotIndex[ex.category] ?? 2;
            const eqDots = equipmentDotIndex[ex.equipment] ?? 2;

            return (
              <div key={ex.id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  style={{
                    background: isExpanded ? '#1a1a22' : 'transparent',
                    borderRadius: isExpanded ? '12px' : '0',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    borderBottom: '1px solid #1a1a22',
                  }}
                >
                  {/* Name column */}
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                  </div>

                  {/* Category dot cluster */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '3px' }}>
                    {[1, 2, 3].map(i => (
                      <span
                        key={i}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: i <= catDots ? '#ffffff' : '#2a2a34',
                          boxShadow: i <= catDots ? '0 0 4px rgba(255,255,255,0.6)' : 'none',
                        }}
                      />
                    ))}
                  </div>

                  {/* Equipment dot cluster */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '3px' }}>
                    {[1, 2, 3].map(i => (
                      <span
                        key={i}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: i <= eqDots ? '#ffffff' : '#2a2a34',
                          boxShadow: i <= eqDots ? '0 0 4px rgba(255,255,255,0.6)' : 'none',
                        }}
                      />
                    ))}
                  </div>

                  {/* Expand chevron */}
                  <div style={{ flex: '0 0 24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <ChevronRight
                      size={14}
                      color="#888894"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                    />
                  </div>
                </div>

                {/* Inline expanded details */}
                {isExpanded && (
                  <div style={{ background: '#14141a', borderRadius: '0 0 12px 12px', padding: '10px 14px 14px 14px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#888894', textTransform: 'uppercase', fontWeight: 700 }}>Category</div>
                        <div style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>{ex.category}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#888894', textTransform: 'uppercase', fontWeight: 700 }}>Muscle</div>
                        <div style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>{ex.muscle}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#888894', textTransform: 'uppercase', fontWeight: 700 }}>Difficulty</div>
                        <div style={{ fontSize: '12px', color: 'white', fontWeight: 700 }}>{ex.difficulty}</div>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onSelectExercise(ex); }}
                      style={{ background: 'white', color: '#0d0d0f', border: 'none', padding: '6px 14px', borderRadius: '14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Select Exercise
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 4: TACTICAL BLACK & AMBER — TACTICAL CARDS
     Frosted glass cards with backdrop-filter, amber category tag in corner,
     equipment/difficulty as icon+label rows, long-press for amber "target" outline.
     ======================================================================== */
  if (themeId === 'tactile-amber') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#ff6000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>TACTICAL DATABASE</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '2px 0 0 0' }}>Exercises</h2>
          </div>
          <button onClick={onAddExerciseClick} className="amber-action-pill" style={{ padding: '8px 14px', fontSize: '11px' }}>
            + NEW ENTRY
          </button>
        </div>

        <div style={{ background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,96,0,0.3)', borderRadius: '18px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} color="#ff6000" />
          <input
            type="text"
            placeholder="Search tactical moves..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(ex => {
            const isTargeted = targetedId === ex.id;
            return (
              <div
                key={ex.id}
                onClick={() => onSelectExercise(ex)}
                onMouseDown={() => handleLongPressStart(ex.id)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={() => handleLongPressStart(ex.id)}
                onTouchEnd={handleLongPressEnd}
                style={{
                  background: 'rgba(30,33,40,0.85)',
                  backdropFilter: 'blur(12px)',
                  border: isTargeted ? '2px solid rgba(255,96,0,0.8)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: isTargeted ? '0 0 20px rgba(255,96,0,0.3)' : 'none',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Amber category tag in top-right corner */}
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '12px',
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: 'rgba(255,96,0,0.25)',
                  color: '#ff6000',
                  border: '1px solid rgba(255,96,0,0.5)',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  letterSpacing: '0.5px',
                }}>
                  {ex.category}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{ex.name}</div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Dumbbell size={11} color="#a0a5b5" />
                      <span style={{ fontSize: '10px', color: '#a0a5b5', fontWeight: 600 }}>{ex.equipment}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#ff6000', fontWeight: 800 }}>◆</span>
                      <span style={{ fontSize: '10px', color: '#a0a5b5', fontWeight: 600 }}>{ex.difficulty}</span>
                    </div>
                  </div>
                </div>

                {isTargeted && (
                  <span style={{ fontSize: '10px', color: '#ff6000', fontWeight: 800, border: '1px solid rgba(255,96,0,0.5)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px' }}>
                    ●
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 5: SWISS BRUTALIST — TYPESET TABLE
     Column headers (NAME / CATEGORY / EQUIPMENT) in 10px uppercase,
     2px black border rows, tap to invert (black bg, white text),
     square-bordered category filter buttons.
     ======================================================================== */
  if (themeId === 'swiss-brutalist') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 className="swiss-header-huge" style={{ fontSize: '28px', margin: 0 }}>EXERCISES</h1>
          <button
            onClick={onAddExerciseClick}
            style={{ background: '#111', color: 'white', border: '2px solid #111', padding: '8px 12px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.5px' }}
          >
            + ADD
          </button>
        </div>

        <div style={{ border: '2px solid #111', background: '#ffffff', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} color="#111" />
          <input
            type="text"
            placeholder="FILTER EXERCISES..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#111', fontSize: '12px', fontWeight: 900, outline: 'none', width: '100%', textTransform: 'uppercase' }}
          />
        </div>

        {/* Square-bordered category filter buttons */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? '#111' : 'transparent',
                color: selectedCategory === cat ? 'white' : '#111',
                border: '2px solid #111',
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', borderBottom: '2px solid #111', paddingBottom: '8px', gap: '0' }}>
          <span style={{ flex: 3, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#111' }}>NAME</span>
          <span style={{ flex: 2, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#111', textAlign: 'center' }}>CATEGORY</span>
          <span style={{ flex: 2, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#111', textAlign: 'right' }}>EQUIPMENT</span>
        </div>

        {/* Table rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map(ex => {
            const isInverted = invertedId === ex.id;
            return (
              <div
                key={ex.id}
                onClick={() => {
                  setInvertedId(isInverted ? null : ex.id);
                  onSelectExercise(ex);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '2px solid #111',
                  padding: '14px 0',
                  cursor: 'pointer',
                  background: isInverted ? '#111' : 'transparent',
                  color: isInverted ? 'white' : '#111',
                  transition: 'background 0.1s ease, color 0.1s ease',
                }}
              >
                <span style={{ flex: 3, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{ex.category}</span>
                <span style={{ flex: 2, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.equipment}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 6: NEUMORPHIC SLATE — CARDS ON WELL
     Entire list inside one large recessed well. Each exercise is an extruded
     card inside. Category filter is extruded toggle-buttons (pressed = recessed).
     ======================================================================== */
  if (themeId === 'neumorphic-slate') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#8b96a5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>DATABASE</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '2px 0 0 0', color: '#dce3eb' }}>Exercises</h2>
          </div>
          <button className="neu-push-button-3d" onClick={onAddExerciseClick} style={{ width: '44px', height: '44px' }}>
            +
          </button>
        </div>

        {/* Search in recessed well */}
        <div className="neu-recessed-well" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} color="#ff5c00" />
          <input
            type="text"
            placeholder="Filter movements..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#dce3eb', fontSize: '13px', outline: 'none', width: '100%' }}
          />
        </div>

        {/* Category filter as extruded toggle-buttons */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  background: '#212529',
                  color: isActive ? '#ff5c00' : '#8b96a5',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive
                    ? 'inset 4px 4px 10px #131517, inset -2px -2px 6px #2b3035'
                    : '5px 5px 12px #16181b, -5px -5px 12px #2c3237',
                  transition: 'box-shadow 0.2s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Cards inside recessed well */}
        <div className="neu-recessed-well" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(ex => (
            <div
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              className="neu-extruded-card-3d"
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '22px' }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#dce3eb' }}>{ex.name}</div>
                <div style={{ fontSize: '11px', color: '#8b96a5', marginTop: '2px' }}>{ex.muscle} · {ex.equipment}</div>
              </div>
              <ChevronRight size={16} color="#8b96a5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 7: LIST-FIRST — TYPESET INDEX
     Single column of names in clean sans-serif, tiny right-aligned category
     label, chevron after each, hairline dividers, underline-style search,
     inline expansion on tap (no modal, no card).
     ======================================================================== */
  if (themeId === 'list-first') {
    return (
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#FAFAFA', color: '#111111', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999999' }}>Exercise Index</span>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0 0', color: '#111111' }}>All Movements</h2>
          </div>
          <button
            onClick={onAddExerciseClick}
            style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            + New
          </button>
        </div>

        {/* Underline-style search */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="list-first-input"
            style={{ fontSize: '15px', padding: '10px 0', color: '#111111', borderBottom: '1px solid #DDD', width: '100%' }}
          />
        </div>

        {/* Filter hint row */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: 'none',
                border: 'none',
                color: selectedCategory === cat ? '#111111' : '#999999',
                fontSize: '12px',
                fontWeight: selectedCategory === cat ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                padding: '2px 0',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Typeset list */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((ex, idx) => {
            const isExpanded = expandedId === ex.id;
            return (
              <div key={ex.id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 0',
                    cursor: 'pointer',
                    borderBottom: idx < filtered.length - 1 || isExpanded ? '1px solid #EEEEEE' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111111' }}>{ex.name}</div>
                    {isExpanded && (
                      <div style={{ paddingTop: '6px', paddingLeft: '12px' }}>
                        <div style={{ fontSize: '13px', color: '#555555', lineHeight: 1.6 }}>{ex.muscle}</div>
                        <div style={{ fontSize: '13px', color: '#555555', lineHeight: 1.6 }}>{ex.equipment}</div>
                        <div style={{ fontSize: '13px', color: '#555555', lineHeight: 1.6 }}>{ex.difficulty}</div>
                        <button
                          onClick={e => { e.stopPropagation(); onSelectExercise(ex); }}
                          style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '4px 0 0 0' }}
                        >
                          Select Exercise
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', color: '#AAAAAA', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ex.category}</span>
                    <ChevronRight size={14} color="#CCCCCC" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 8: GAMIFIED — COLLECTIBLE CARDS
     Rounded cards with category emoji, level badge, progress bar, locked
     exercises grayed with 🔒, horizontal scroll of round emoji category bubbles.
     ======================================================================== */
  if (themeId === 'gamified') {
    const lockedIds = new Set(INITIAL_EXERCISES.filter(ex => ex.difficulty === 'Advanced').map(ex => ex.id));

    const categoryEmojiForFilter: Record<string, string> = {
      All: '\u{1F3CB}',
      Chest: '\u{1F4AA}',
      Back: '\u{1F985}',
      Legs: '\u{1F9B5}',
      Shoulders: '\u{1F3CB}',
      Arms: '\u{1F9BE}',
      Core: '\u{1F3AF}',
    };

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#1E1B4B', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#A855F7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>COLLECTION</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '2px 0 0 0' }}>Exercise Cards</h2>
          </div>
          <button onClick={onAddExerciseClick} style={{ background: 'linear-gradient(135deg, #A855F7, #7C3AED)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }}>
            + New Card
          </button>
        </div>

        {/* Search */}
        <div style={{ background: '#312E81', borderRadius: '18px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={16} color="#8B8CC7" />
          <input
            type="text"
            placeholder="Search your collection..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none', width: '100%' }}
          />
        </div>

        {/* Horizontal scroll of round emoji category bubbles */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: selectedCategory === cat ? '#A855F7' : '#312E81',
                border: selectedCategory === cat ? '2px solid #C084FC' : '2px solid rgba(255,255,255,0.1)',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: selectedCategory === cat ? '0 4px 12px rgba(168,85,247,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
              title={cat}
            >
              {categoryEmojiForFilter[cat] ?? '\u{1F3CB}'}
            </button>
          ))}
        </div>

        {/* Collectible cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(ex => {
            const isLocked = lockedIds.has(ex.id);
            const progress = mockUsageProgress[ex.id] ?? 20;
            const emoji = categoryEmojiMap[ex.category] ?? '\u{1F4AA}';

            return (
              <div
                key={ex.id}
                onClick={() => !isLocked && onSelectExercise(ex)}
                style={{
                  background: isLocked ? 'rgba(49,46,129,0.5)' : '#312E81',
                  borderRadius: '24px',
                  padding: '16px',
                  display: 'flex',
                  gap: '14px',
                  cursor: isLocked ? 'default' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                  position: 'relative',
                  boxShadow: isLocked ? 'none' : '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                {/* Emoji icon */}
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: isLocked ? 'rgba(255,255,255,0.05)' : 'rgba(168,85,247,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0,
                }}>
                  {emoji}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{ex.name}</span>
                    {isLocked && <span style={{ fontSize: '12px' }}>{'\u{1F512}'}</span>}
                  </div>

                  {/* Level badge */}
                  <span style={{
                    display: 'inline-block',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    marginTop: '4px',
                    background: ex.difficulty === 'Beginner' ? 'rgba(34,197,94,0.2)' : ex.difficulty === 'Intermediate' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                    color: ex.difficulty === 'Beginner' ? '#22C55E' : ex.difficulty === 'Intermediate' ? '#F59E0B' : '#EF4444',
                  }}>
                    {difficultyBadge[ex.difficulty]}
                  </span>

                  {/* Progress bar */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '9px', color: '#8B8CC7', fontWeight: 600 }}>Usage</span>
                      <span style={{ fontSize: '9px', color: '#8B8CC7', fontWeight: 600 }}>{progress}%</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: isLocked ? '#666' : 'linear-gradient(90deg, #A855F7, #22C55E)',
                        borderRadius: '5px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 9: RETRO — INDEX CARD STACK
     Each exercise is a 3x5 cream card (rounded corners, slight shadow).
     Name in handwritten marker-style (Caveat bold), details in pencil
     (smaller, lighter Caveat). Cards show slight offset/stack effect.
     Filter = card-catalog tabbed dividers at top.
     ======================================================================== */
  if (themeId === 'retro') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#1E3A2F', color: '#F5F5DC', fontFamily: "'Caveat', cursive, sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '13px', opacity: 0.5, letterSpacing: '1px' }}>Card Catalog</span>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '2px 0 0 0', fontFamily: "'Caveat', cursive" }}>Exercise Index</h2>
          </div>
          <button
            onClick={onAddExerciseClick}
            style={{ background: 'none', border: '1px dashed rgba(245,245,220,0.4)', color: '#F5F5DC', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: "'Caveat', cursive", cursor: 'pointer' }}
          >
            + New Card
          </button>
        </div>

        {/* Card-catalog tabbed dividers */}
        <div className="retro-tab-divider">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`retro-tab${selectedCategory === cat ? ' active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,245,220,0.05)', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(245,245,220,0.15)' }}>
          <Search size={14} color="rgba(245,245,220,0.4)" />
          <input
            type="text"
            placeholder="Flip through cards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#F5F5DC', fontSize: '14px', outline: 'none', width: '100%', fontFamily: "'Caveat', cursive" }}
          />
        </div>

        {/* Index card stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.map((ex, idx) => (
            <div
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              style={{
                background: '#FFF8E7',
                borderRadius: '8px',
                padding: '18px 16px 14px 16px',
                boxShadow: '3px 4px 8px rgba(0,0,0,0.25), 1px 1px 0 rgba(255,255,255,0.1)',
                border: '1px solid #DDD8C8',
                cursor: 'pointer',
                position: 'relative',
                transform: `rotate(${idx % 2 === 0 ? -0.8 : 1.2}deg) translateY(${idx * 0.5}px)`,
                zIndex: filtered.length - idx,
                marginLeft: `${idx * 2}px`,
                marginRight: `${-idx * 1}px`,
              }}
            >
              {/* Name in marker-style (Caveat bold) */}
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1A1A1A', fontFamily: "'Caveat', cursive", lineHeight: 1.2 }}>
                {ex.name}
              </div>

              {/* Pencil details (smaller, lighter Caveat) */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <span style={{ fontSize: '14px', color: '#666666', fontFamily: "'Caveat', cursive", fontStyle: 'italic' }}>
                  {ex.muscle}
                </span>
                <span style={{ fontSize: '14px', color: '#888888', fontFamily: "'Caveat', cursive", fontStyle: 'italic' }}>
                  {ex.equipment}
                </span>
              </div>

              {/* Difficulty as small pencil note */}
              <div style={{ fontSize: '12px', color: '#999999', fontFamily: "'Caveat', cursive", fontStyle: 'italic', marginTop: '4px' }}>
                {ex.difficulty}
              </div>

              {/* Subtle tape mark in corner */}
              <div style={{
                position: 'absolute',
                top: '-6px',
                right: '20px',
                width: '40px',
                height: '14px',
                background: 'rgba(255,255,200,0.55)',
                borderRadius: '2px',
                transform: 'rotate(2deg)',
              }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 10: BENTO GRID — WIDGET GRID (DEFAULT)
     Bento grid layout with large tiles for favorites and small tiles for
     others. Category filter tiles at top. Grid reflows on filter.
     ======================================================================== */
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#F4F4F6', color: '#1F2937', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Widgets</span>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: '2px 0 0 0', color: '#1F2937' }}>Exercise Library</h2>
        </div>
        <button
          onClick={onAddExerciseClick}
          style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
        >
          + New
        </button>
      </div>

      {/* Category filter tiles */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? '#4F46E5' : '#FFFFFF',
              color: selectedCategory === cat ? 'white' : '#6B7280',
              border: '1px solid rgba(0,0,0,0.06)',
              padding: '8px 14px',
              borderRadius: '14px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search tile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', borderRadius: '16px', padding: '12px 14px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Search size={16} color="#9CA3AF" />
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: '#1F2937', fontSize: '13px', outline: 'none', width: '100%', fontWeight: 600 }}
        />
      </div>

      {/* Bento grid */}
      <div className="bento-grid">
        {filtered.map((ex, idx) => {
          const isFavorite = favoriteIds.has(ex.id);
          const isLarge = isFavorite && idx < 3;

          return (
            <div
              key={ex.id}
              onClick={() => onSelectExercise(ex)}
              className={`bento-tile ${isLarge ? 'bento-tile-lg' : idx % 2 === 0 ? 'bento-tile-sm' : 'bento-tile-sm'}`}
              style={{
                cursor: 'pointer',
                justifyContent: isLarge ? 'space-between' : 'center',
              }}
            >
              {isLarge ? (
                <>
                  <div style={{ flex: 1 }}>
                    <div className="bento-tile-label">FAVORITE</div>
                    <div className="bento-tile-title" style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{ex.name}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: '#EEF2FF', color: '#4F46E5', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>{ex.category}</span>
                      <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#6B7280', padding: '3px 8px', borderRadius: '8px', fontWeight: 600 }}>{ex.difficulty}</span>
                    </div>
                  </div>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}>
                    {categoryEmojiMap[ex.category] ?? '\u{1F4AA}'}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{ex.muscle}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{ex.equipment}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>{categoryEmojiMap[ex.category] ?? '\u{1F4AA}'}</span>
                    <span className="bento-tile-label">{ex.category}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: 'auto' }}>
                    {ex.equipment}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
