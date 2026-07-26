import React, { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import type { ThemeId, ActiveExercise } from '../types';

interface Props {
  themeId: ThemeId;
  activeExercises: ActiveExercise[];
  onToggleSet: (exerciseId: string, setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onOpenAddExercise: () => void;
  onFinishSession: () => void;
}

interface XpAnimation {
  id: string;
}

export const GymSessionScreen: React.FC<Props> = ({
  themeId,
  activeExercises,
  onToggleSet,
  onAddSet,
  onOpenAddExercise,
  onFinishSession,
}) => {
  const [seconds, setSeconds] = useState(1450);
  const [xpAnimations, setXpAnimations] = useState<XpAnimation[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalVolume = activeExercises.reduce((sum, ex) => {
    return sum + ex.sets.filter(s => s.completed).reduce((sSum, s) => sSum + s.weightKg * s.reps, 0);
  }, 0);

  const handleToggleWithXp = useCallback((exerciseId: string, setId: string) => {
    const ex = activeExercises.find(e => e.id === exerciseId);
    const set = ex?.sets.find(s => s.id === setId);
    const wasUncompleted = set && !set.completed;
    onToggleSet(exerciseId, setId);
    if (wasUncompleted) {
      const animId = `${exerciseId}-${setId}-${Date.now()}`;
      setXpAnimations(prev => [...prev, { id: animId }]);
      setTimeout(() => {
        setXpAnimations(prev => prev.filter(a => a.id !== animId));
      }, 1100);
    }
  }, [activeExercises, onToggleSet]);

  const sessionDurationSec = 3600;
  const elapsedPct = Math.min((seconds % sessionDurationSec) / sessionDurationSec, 1);
  const svgCircumference = 2 * Math.PI * 58;

  /* ========================================================================
     THEME 1: CLAY INDIGO — PUNCH-CARD PARADIGM
     Timer in ticket-stub card. Exercise tickets with name on peach.
     Sets as circular clay tokens (green=punched, indigo outline=unpunched).
     Floating clay FAB for add-set. Finish button in indigo.
     ======================================================================== */
  if (themeId === 'clay-indigo') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Punch-card timer stub */}
        <div className="clay-ticket-stub">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#2b2754', letterSpacing: '1px', textTransform: 'uppercase' }}>Punch Card</span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#634b28' }}>{totalVolume} kg</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0' }}>
            <div style={{ fontSize: '34px', fontWeight: 900, fontFamily: 'monospace', color: '#2b2754' }}>
              {formatTimer(seconds)}
            </div>
            <button
              onClick={onFinishSession}
              style={{ background: '#2b2754', color: '#fce1b4', border: 'none', padding: '10px 20px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
            >
              FINISH PUNCH
            </button>
          </div>
        </div>

        {/* Exercise tickets */}
        {activeExercises.map(ex => (
          <div key={ex.id} style={{ background: '#393369', borderRadius: '24px', padding: '16px', position: 'relative' }}>
            <div style={{ background: '#fce3b8', borderRadius: '14px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#634b28', flexShrink: 0 }} />
              <h4 style={{ fontSize: '15px', fontWeight: 900, margin: 0, color: '#2b2754', fontFamily: 'Outfit, sans-serif' }}>{ex.name}</h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {ex.sets.map(s => (
                <button
                  key={s.id}
                  onClick={() => onToggleSet(ex.id, s.id)}
                  title={`${s.weightKg}kg × ${s.reps}`}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: s.completed ? 'none' : '2px dashed #fce1b4',
                    background: s.completed ? '#10b981' : 'transparent',
                    color: s.completed ? '#fff' : '#fce1b4',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '10px',
                    boxShadow: s.completed ? '0 3px 8px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  {s.completed ? <Check size={14} /> : s.setNum}
                </button>
              ))}
            </div>
            {/* Floating clay FAB for add-set */}
            <button
              onClick={() => onAddSet(ex.id)}
              style={{
                position: 'absolute',
                bottom: '-14px',
                right: '16px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#fce1b4',
                color: '#2b2754',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              +
            </button>
          </div>
        ))}

        <button onClick={onOpenAddExercise} style={{ background: '#fce1b4', color: '#2b2754', border: 'none', padding: '14px', borderRadius: '20px', fontWeight: 900, cursor: 'pointer', fontSize: '13px' }}>
          + ADD EXERCISE TICKET
        </button>
      </div>
    );
  }

  /* ========================================================================
     THEME 2: WARM LATTE — BARISTA ORDER TICKETS PARADIGM
     Each exercise is a tall order-slip. Name in serif.
     Sets as "shots" — round ○ tokens that fill in as completed.
     Large circular bezel timer dial. Finish = attached pill with circular badge.
     ======================================================================== */
  if (themeId === 'warm-latte') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Bezel timer dial */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div className="latte-circle-bezel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', color: '#e8dfce', textTransform: 'uppercase', letterSpacing: '2px' }}>Brewing</span>
            <span style={{ fontSize: '30px', fontWeight: 900, color: '#f7f1e3', fontFamily: 'serif' }}>{formatTimer(seconds)}</span>
          </div>
          <button onClick={onFinishSession} className="latte-attached-pill-btn" style={{ width: '100%', justifyContent: 'center' }}>
            FINISH SESSION
            <span className="latte-attached-badge" style={{ marginLeft: '8px', background: '#e8dfce', color: '#3e2a1b' }}>
              <Check size={16} />
            </span>
          </button>
        </div>

        {/* Order-slip exercises */}
        {activeExercises.map(ex => (
          <div key={ex.id} style={{ background: '#faf5e8', borderRadius: '20px', padding: '18px', border: '1px solid #d4c5b0', boxShadow: '2px 2px 0px rgba(0,0,0,0.08)' }}>
            <div style={{ borderBottom: '1px dashed #c2b49e', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#3e2a1b', fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>{ex.name}</h4>
              <button onClick={() => onAddSet(ex.id)} style={{ background: '#3e2a1b', color: '#e8dfce', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}>
                + Shot
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {ex.sets.map(s => (
                <button
                  key={s.id}
                  onClick={() => onToggleSet(ex.id, s.id)}
                  title={`${s.weightKg}kg × ${s.reps}`}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    border: `2px solid ${s.completed ? '#3e2a1b' : '#c2b49e'}`,
                    background: s.completed ? '#3e2a1b' : 'transparent',
                    color: s.completed ? '#f7f1e3' : '#7a5839',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '9px',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  {s.completed ? <Check size={14} /> : (
                    <>
                      <span style={{ fontSize: '10px', fontWeight: 800 }}>{s.weightKg}kg</span>
                      <span style={{ fontSize: '8px' }}>×{s.reps}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={onOpenAddExercise} style={{ width: '100%', padding: '12px', borderRadius: '20px', background: '#3e2a1b', color: '#e8dfce', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>
          + ADD ORDER
        </button>
      </div>
    );
  }

  /* ========================================================================
     THEME 3: STEALTH DARK — MINIMAL SET TABLE PARADIGM
     Exercise rows with large white numerals as set numbers.
     Weight/reps in dim gray. ▮ = completed, ▯ = uncompleted.
     NO CARDS — just rows separated by hairline borders.
     Huge white timer number top-right.
     ======================================================================== */
  if (themeId === 'dark-stealth') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '0', fontFamily: 'Inter, sans-serif' }}>
        {/* Timer header — huge, top-right aligned */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '20px', borderBottom: '1px solid #22222a' }}>
          <span style={{ fontSize: '11px', color: '#888894', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Session</span>
          <span style={{ fontSize: '42px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', lineHeight: 1 }}>{formatTimer(seconds)}</span>
        </div>

        {activeExercises.map(ex => (
          <div key={ex.id} style={{ borderBottom: '1px solid #22222a', padding: '16px 0' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '0 0 14px 0', letterSpacing: '-0.3px' }}>{ex.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ex.sets.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ width: '28px', fontSize: '20px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1 }}>
                    {String(s.setNum).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#888894', flex: 1 }}>
                    {s.weightKg} kg × {s.reps}
                  </span>
                  <button
                    onClick={() => onToggleSet(ex.id, s.id)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'transparent',
                      color: s.completed ? '#ffffff' : '#444450',
                      cursor: 'pointer',
                      fontSize: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {s.completed ? '▮' : '▯'}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => onAddSet(ex.id)}
              style={{ marginTop: '10px', background: 'transparent', color: '#666670', border: 'none', padding: '0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add set
            </button>
          </div>
        ))}

        <div style={{ paddingTop: '20px', borderTop: '1px solid #22222a', marginTop: '8px', display: 'flex', gap: '12px' }}>
          <button onClick={onOpenAddExercise} style={{ flex: 1, background: 'transparent', color: '#888894', border: 'none', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
            + Add exercise
          </button>
          <button onClick={onFinishSession} style={{ background: '#ffffff', color: '#000000', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
            Finish
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 4: TACTICAL AMBER — MISSION HUD PARADIGM
     Frosted-glass panels. Timeline stepper at top (4 nodes).
     Sets: "ARMED" (amber tag) / "COMPLETE" (amber filled).
     Timer is a frosted pill with amber digits.
     Finish = amber action pill.
     ======================================================================== */
  if (themeId === 'tactile-amber') {
    const timelineNodes = ['Warm Up', 'Bench', 'Triceps', 'Finish'];
    // Index based on how many exercises have all sets completed
    const completedExCount = activeExercises.filter(ex => ex.sets.every(s => s.completed)).length;
    const currentStep = Math.min(completedExCount, 3);

    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Timeline Stepper */}
        <div style={{ background: 'rgba(30,33,40,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,96,0,0.2)', borderRadius: '20px', padding: '16px' }}>
          <div className="amber-timeline-track">
            {timelineNodes.map((label, i) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                <div className={`amber-timeline-node ${i <= currentStep ? 'done' : ''}`} />
                <span style={{ fontSize: '9px', color: i <= currentStep ? '#ff6000' : '#505565', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frosted timer pill */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,96,0,0.3)', borderRadius: '24px', padding: '12px 20px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: '#ff6000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Mission Clock</span>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#ff6000', fontFamily: 'monospace' }}>{formatTimer(seconds)}</span>
          </div>
          <span style={{ fontSize: '12px', color: '#808595', fontWeight: 700 }}>{totalVolume} kg</span>
        </div>

        {/* Exercise frosted glass panels */}
        {activeExercises.map(ex => (
          <div key={ex.id} style={{ background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>{ex.name}</h4>
              <button onClick={() => onAddSet(ex.id)} style={{ background: 'rgba(255,96,0,0.15)', color: '#ff6000', border: '1px solid rgba(255,96,0,0.3)', padding: '4px 12px', borderRadius: '14px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                + SET
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ex.sets.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '12px', background: s.completed ? 'rgba(255,96,0,0.08)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#a0a5b5' }}>SET {s.setNum}</span>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: s.completed ? 'rgba(255,96,0,0.25)' : 'rgba(255,96,0,0.1)',
                      color: s.completed ? '#ff6000' : 'rgba(255,96,0,0.5)',
                      border: `1px solid ${s.completed ? 'rgba(255,96,0,0.5)' : 'rgba(255,96,0,0.15)'}`,
                    }}>
                      {s.completed ? 'COMPLETE' : 'ARMED'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '13px' }}>{s.weightKg} kg × {s.reps}</span>
                    <button
                      onClick={() => onToggleSet(ex.id, s.id)}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${s.completed ? '#ff6000' : 'rgba(255,255,255,0.15)'}`, background: s.completed ? '#ff6000' : 'transparent', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onOpenAddExercise} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#a0a5b5', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
            + ADD EXERCISE
          </button>
          <button onClick={onFinishSession} className="amber-action-pill" style={{ padding: '12px 24px', fontSize: '12px' }}>
            COMPLETE MISSION
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 5: SWISS BRUTALIST — LOG SHEET PARADIGM
     Full-width blocks with thick 2px top border.
     Name in 18px ALL CAPS. Sets as square-bordered TABLE.
     SET / WEIGHT / REPS / DONE column headers.
     Completed = black-filled square + white ✓.
     Timer as huge header. BOLD borders, zero radius, zero shadows.
     ======================================================================== */
  if (themeId === 'swiss-brutalist') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '0', background: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        {/* Huge timer header */}
        <h1 style={{ fontSize: '38px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1.5px', borderBottom: '3px solid #111111', paddingBottom: '8px', margin: '0 0 16px 0', color: '#111111' }}>
          {formatTimer(seconds)}
        </h1>

        {/* Volume summary line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111111', paddingBottom: '10px', marginBottom: '0' }}>
          <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: '#111111' }}>Total Volume</span>
          <span style={{ fontSize: '18px', fontWeight: 900, color: '#111111' }}>{totalVolume} KG</span>
        </div>

        {activeExercises.map(ex => (
          <div key={ex.id} style={{ borderTop: '2px solid #111111', padding: '16px 0' }}>
            {/* ALL CAPS exercise name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#111111', letterSpacing: '-0.5px' }}>{ex.name}</h4>
              <button onClick={() => onAddSet(ex.id)} style={{ background: '#111111', color: '#ffffff', border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0' }}>
                + SET
              </button>
            </div>

            {/* Column header table */}
            <div style={{ border: '2px solid #111111', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr', borderBottom: '2px solid #111111', background: '#111111', color: '#ffffff' }}>
                <span style={{ padding: '8px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>SET</span>
                <span style={{ padding: '8px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>WEIGHT</span>
                <span style={{ padding: '8px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>REPS</span>
                <span style={{ padding: '8px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center' }}>DONE</span>
              </div>
              {/* Table rows */}
              {ex.sets.map(s => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr', borderBottom: '1px solid #111111' }}>
                  <span style={{ padding: '10px', fontSize: '14px', fontWeight: 900, color: '#111111', borderRight: '1px solid #dddddd' }}>{s.setNum}</span>
                  <span style={{ padding: '10px', fontSize: '14px', fontWeight: 700, color: '#111111', borderRight: '1px solid #dddddd' }}>{s.weightKg} kg</span>
                  <span style={{ padding: '10px', fontSize: '14px', fontWeight: 700, color: '#111111', borderRight: '1px solid #dddddd' }}>{s.reps}</span>
                  <button
                    onClick={() => onToggleSet(ex.id, s.id)}
                    style={{
                      padding: '10px',
                      border: 'none',
                      background: s.completed ? '#111111' : 'transparent',
                      color: s.completed ? '#ffffff' : '#cccccc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 900,
                      borderRadius: '0',
                    }}
                  >
                    {s.completed ? '✓' : ''}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ borderTop: '2px solid #111111', paddingTop: '16px', display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button onClick={onOpenAddExercise} style={{ flex: 1, background: 'transparent', color: '#111111', border: '2px solid #111111', padding: '14px', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0' }}>
            + ADD EXERCISE
          </button>
          <button onClick={onFinishSession} style={{ background: '#ff3b00', color: '#ffffff', border: 'none', padding: '14px 24px', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', borderRadius: '0' }}>
            FINISH WORKOUT SESSION →
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 6: NEUMORPHIC SLATE — CONTROL CONSOLE PARADIGM
     Extruded panels. Recessed well containing set table.
     Completed sets glow ember (orange).
     Main timer in large recessed well with glowing ember ring.
     Add-set = extruded circular push-button.
     Finish = extruded dial button.
     ======================================================================== */
  if (themeId === 'neumorphic-slate') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Large recessed well timer with ember ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: '#1b1e21',
            boxShadow: 'inset 6px 6px 14px #131517, inset -6px -6px 14px #23272b, 0 0 20px rgba(255,79,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255,79,0,0.2)',
          }}>
            <span style={{ fontSize: '9px', color: '#8b96a5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Timer</span>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#dce3eb', fontFamily: 'monospace' }}>
              {formatTimer(seconds)}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#8b96a5', fontWeight: 700 }}>{totalVolume} kg total</span>
        </div>

        {/* Exercise extruded panels */}
        {activeExercises.map(ex => (
          <div key={ex.id} className="neu-extruded-card-3d" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#dce3eb', margin: 0 }}>{ex.name}</h4>
              <button onClick={() => onAddSet(ex.id)} className="neu-push-button-3d" style={{ width: '36px', height: '36px', fontSize: '16px' }}>
                +
              </button>
            </div>
            {/* Recessed well containing set table */}
            <div className="neu-recessed-well">
              {ex.sets.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: i < ex.sets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: s.completed ? 'rgba(255,79,0,0.08)' : 'transparent',
                    borderRadius: '6px',
                    margin: '2px 0',
                  }}
                >
                  <span style={{ fontWeight: 800, color: s.completed ? '#ff4f00' : '#8b96a5', fontSize: '13px' }}>SET #{s.setNum}</span>
                  <span style={{ fontWeight: 600, color: s.completed ? '#dce3eb' : '#8b96a5', fontSize: '12px' }}>{s.weightKg} kg × {s.reps}</span>
                  <button
                    onClick={() => onToggleSet(ex.id, s.id)}
                    className="neu-push-button-3d"
                    style={{
                      width: '32px',
                      height: '32px',
                      boxShadow: s.completed
                        ? '0 0 12px rgba(255,79,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.4)'
                        : undefined,
                      background: s.completed ? 'linear-gradient(145deg, #ff5c00, #e04700)' : undefined,
                      color: s.completed ? '#ffffff' : undefined,
                    }}
                  >
                    <Check size={12} color={s.completed ? '#ffffff' : '#8b96a5'} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={onOpenAddExercise} className="neu-push-button-3d" style={{ width: 'auto', height: 'auto', borderRadius: '20px', padding: '10px 18px', fontSize: '12px', fontWeight: 800 }}>
            + Add Exercise
          </button>
          <button onClick={onFinishSession} className="neu-dial-button-ember">
            <Check size={24} color="white" />
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 7: LIST-FIRST — PLAIN LOG PARADIGM (NEW)
     Exercise section headers (no background/card).
     Sets as indented plain text: "1. 80kg × 10  ✓"
     Active set underlined. Completed = ✓.
     Monospace timer top-right.
     "Done →" text-link. No cards, no shadows.
     Hairline section dividers only.
     ======================================================================== */
  if (themeId === 'list-first') {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0', fontFamily: 'Inter, sans-serif', color: '#111111', minHeight: '100%' }}>
        {/* Header row: monospace timer top-right + title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '16px', borderBottom: '1px solid #EEEEEE', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111111' }}>Session Log</h3>
          <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: '#999999' }}>{formatTimer(seconds)}</span>
        </div>

        {/* Volume line */}
        <div style={{ fontSize: '12px', color: '#999999', paddingBottom: '4px' }}>
          {totalVolume} kg total
        </div>

        {activeExercises.map(ex => {
          const firstIncompleteIdx = ex.sets.findIndex(s => !s.completed);
          return (
            <div key={ex.id} style={{ padding: '14px 0', borderBottom: '1px solid #EEEEEE' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111111' }}>{ex.name}</h4>
                <button onClick={() => onAddSet(ex.id)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  + set
                </button>
              </div>
              <div style={{ paddingLeft: '12px' }}>
                {ex.sets.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => onToggleSet(ex.id, s.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '3px 0',
                      cursor: 'pointer',
                      fontSize: '13px',
                      lineHeight: '1.8',
                      fontFamily: 'monospace',
                      color: s.completed ? '#999999' : '#111111',
                      textDecoration: i === firstIncompleteIdx && !s.completed ? 'underline' : 'none',
                    }}
                  >
                    {s.setNum}. {s.weightKg}kg × {s.reps}  {s.completed ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={onOpenAddExercise} className="list-first-link" style={{ textAlign: 'left', padding: '4px 0', fontSize: '13px' }}>
            + Add exercise
          </button>
          <button onClick={onFinishSession} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '0', textAlign: 'left' }}>
            Done →
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 8: GAMIFIED — GAME HUD PARADIGM (NEW)
     Exercise cards with progress bar. Sets as round tokens (💪 / ○).
     XP float animation on complete. Circular SVG ring timer.
     Streak counter banner. Finish = bouncy pill "Finish Strong! 🏆".
     ======================================================================== */
  if (themeId === 'gamified') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Outfit, sans-serif' }}>
        {/* Streak counter banner */}
        <div className="game-streak-banner">
          <span>🔥 4-day streak!</span>
          <span style={{ fontSize: '12px', opacity: 0.85 }}>Keep it going!</span>
        </div>

        {/* Circular SVG ring timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
              <circle
                cx="70" cy="70" r="58"
                fill="none"
                stroke="#22C55E"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={svgCircumference}
                strokeDashoffset={svgCircumference * (1 - elapsedPct)}
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>{formatTimer(seconds)}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Session</span>
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#8B8CC7' }}>{totalVolume} kg · Vol</span>
        </div>

        {/* Exercise game-cards */}
        {activeExercises.map(ex => {
          const completedCount = ex.sets.filter(s => s.completed).length;
          const totalCount = ex.sets.length;
          const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

          return (
            <div key={ex.id} className="game-card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>{ex.name}</h4>
                <button onClick={() => onAddSet(ex.id)} style={{ background: 'rgba(168,85,247,0.25)', color: '#C084FC', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  + Set
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #22C55E, #A855F7)', width: `${progressPct}%`, transition: 'width 0.3s ease' }} />
              </div>

              {/* Set tokens */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {ex.sets.map(s => (
                  <div key={s.id} style={{ position: 'relative' }}>
                    <button
                      onClick={() => handleToggleWithXp(ex.id, s.id)}
                      className={`game-set-token ${s.completed ? 'completed' : ''}`}
                      title={`${s.weightKg}kg × ${s.reps}`}
                    >
                      {s.completed ? '💪' : '○'}
                    </button>
                    {/* XP float animation */}
                    {xpAnimations.some(a => a.id.startsWith(`${ex.id}-${s.id}-`)) && (
                      <span className="game-xp-float" style={{ left: '50%', top: '-8px', transform: 'translateX(-50%)' }}>
                        +10 XP
                      </span>
                    )}
                    <span style={{ display: 'block', textAlign: 'center', fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                      {s.weightKg}×{s.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={onOpenAddExercise} style={{ background: 'rgba(255,255,255,0.08)', color: '#C084FC', border: '1px solid rgba(168,85,247,0.3)', padding: '12px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            + Add Exercise
          </button>
          <button onClick={onFinishSession} className="game-pill-btn" style={{ animation: 'none' }}>
            Finish Strong! 🏆
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================
     THEME 9: RETRO — HANDWRITTEN LOG PARADIGM (NEW)
     Cream ruled-paper background. Blue ink (Caveat, #1E40AF).
     Sets as handwritten tally. Completing = strikethrough.
     Doodled stopwatch timer. Sign off → in pencil style.
     ======================================================================== */
  if (themeId === 'retro') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Caveat, cursive, sans-serif' }}>
        {/* Doodled timer + heading */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'rgba(245,245,220,0.85)', fontFamily: 'Caveat, cursive, sans-serif', letterSpacing: '1px' }}>
              Workout Log
            </h2>
            <span style={{ fontSize: '12px', color: 'rgba(245,245,220,0.4)' }}>{totalVolume} kg</span>
          </div>
          <div className="retro-doodle-timer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '20px' }}>⏱</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(245,245,220,0.85)', fontFamily: 'Caveat, cursive, sans-serif' }}>{formatTimer(seconds)}</span>
          </div>
        </div>

        <hr className="retro-chalk-divider" />

        {/* Notebook paper block */}
        <div className="retro-notebook-page" style={{ padding: '20px 16px' }}>
          {activeExercises.map(ex => (
            <div key={ex.id} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <h4 className="retro-ink-blue" style={{ fontSize: '20px', fontWeight: 700, margin: 0, lineHeight: '28px' }}>
                  {ex.name}
                </h4>
                <button onClick={() => onAddSet(ex.id)} className="retro-ink-blue" style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Caveat, cursive, sans-serif', padding: 0 }}>
                  + set
                </button>
              </div>
              <div style={{ paddingLeft: '10px' }}>
                {ex.sets.map(s => (
                  <div
                    key={s.id}
                    onClick={() => onToggleSet(ex.id, s.id)}
                    className={`retro-ink-blue ${s.completed ? 'retro-cross-off' : ''}`}
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      lineHeight: '28px',
                      cursor: 'pointer',
                      fontFamily: 'Caveat, cursive, sans-serif',
                      color: s.completed ? 'rgba(30,64,175,0.45)' : '#1E40AF',
                      textDecoration: s.completed ? 'line-through' : 'none',
                    }}
                  >
                    {s.setNum}. {s.weightKg}kg × {s.reps}
                    {s.completed ? ' ✓' : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button onClick={onOpenAddExercise} className="retro-ink-blue" style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Caveat, cursive, sans-serif', padding: 0, marginTop: '8px' }}>
            + Add exercise
          </button>
        </div>

        {/* Sign off in pencil */}
        <button
          onClick={onFinishSession}
          style={{
            background: 'none',
            border: '2px dashed rgba(245,245,220,0.2)',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: 'Caveat, cursive, sans-serif',
            color: 'rgba(245,245,220,0.6)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Sign off →
        </button>
      </div>
    );
  }

  /* ========================================================================
     THEME 10: BENTO GRID — LIVE WIDGET BOARD PARADIGM (NEW)
     Bento grid layout. Active exercise = large tile (2x2).
     Completed exercises = small dimmed tiles (1x1, opacity 0.5).
     Next exercise = medium tile (2x1).
     Timer = wide tile (2x1) across top.
     Add exercise = small "+" tile.
     ======================================================================== */
  {
    // Categorize exercises by status
    const activeEx = activeExercises.find(ex => !ex.sets.every(s => s.completed)) ?? activeExercises[0];
    const completedExs = activeExercises.filter(ex => ex.sets.every(s => s.completed) && ex.sets.length > 0);
    const pendingExs = activeExercises.filter(ex => ex !== activeEx && !completedExs.includes(ex));

    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', gridAutoRows: '120px' }}>
          {/* Timer — wide tile (2x1) at top */}
          <div className="bento-tile bento-tile-md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <span className="bento-tile-label">Session Timer</span>
            <span className="bento-tile-value" style={{ fontSize: '30px', fontFamily: 'monospace' }}>{formatTimer(seconds)}</span>
            <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600 }}>{totalVolume} kg</span>
          </div>

          {/* Completed exercises — small dimmed tiles (1x1 each) */}
          {completedExs.map(ex => (
            <div key={ex.id} className="bento-tile bento-tile-sm" style={{ opacity: 0.5, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✓ Done</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', textAlign: 'center', lineHeight: '1.3' }}>{ex.name}</span>
            </div>
          ))}

          {/* Active exercise — large tile (2x2) */}
          {activeEx && (
            <div className="bento-tile bento-tile-lg" style={{ background: '#FFFFFF', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="bento-tile-title" style={{ color: '#4F46E5' }}>{activeEx.name}</span>
                <button onClick={() => onAddSet(activeEx.id)} style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>
                  + Set
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeEx.sets.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280' }}>Set {s.setNum}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1F2937' }}>{s.weightKg}kg × {s.reps}</span>
                    <button
                      onClick={() => onToggleSet(activeEx.id, s.id)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: s.completed ? '#22C55E' : 'rgba(0,0,0,0.06)',
                        color: s.completed ? 'white' : '#9CA3AF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                      }}
                    >
                      {s.completed ? '✓' : ''}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending exercises — medium tiles (2x1 each) */}
          {pendingExs.map(ex => (
            <div key={ex.id} className="bento-tile bento-tile-md" style={{ justifyContent: 'center' }}>
              <span className="bento-tile-label">Next</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1F2937' }}>{ex.name}</span>
              <span style={{ fontSize: '10px', color: '#6B7280' }}>{ex.sets.filter(s => !s.completed).length} sets remaining</span>
            </div>
          ))}

          {/* Add exercise tile — small "+" tile */}
          <button onClick={onOpenAddExercise} className="bento-tile bento-tile-sm" style={{ justifyContent: 'center', alignItems: 'center', background: '#FFFFFF', cursor: 'pointer', borderStyle: 'dashed' }}>
            <span style={{ fontSize: '28px', fontWeight: 300, color: '#9CA3AF', lineHeight: 1 }}>+</span>
            <span style={{ fontSize: '9px', color: '#6B7280', fontWeight: 600 }}>Add Ex</span>
          </button>

          {/* Finish tile — wide */}
          <button onClick={onFinishSession} className="bento-tile bento-tile-md" style={{ justifyContent: 'center', alignItems: 'center', background: '#4F46E5', color: 'white', cursor: 'pointer', border: 'none' }}>
            <span style={{ fontSize: '14px', fontWeight: 800 }}>Finish Session →</span>
          </button>
        </div>
      </div>
    );
  }
};
