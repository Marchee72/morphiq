import React from 'react';
import { TrendingUp, Sparkles, Play, Search, Plus, Dumbbell, ArrowRight } from 'lucide-react';
import type { ThemeId } from '../types';

interface Props {
  themeId: ThemeId;
  onNavigate: (screen: 'exercises' | 'gym' | 'coach' | 'add_exercise') => void;
}

export const MainScreen: React.FC<Props> = ({ themeId, onNavigate }) => {
  const handleNavCoach = () => onNavigate('coach');
  const handleNavGym = () => onNavigate('gym');
  const handleNavAdd = () => onNavigate('add_exercise');

  /* PROPOSAL 1: CLAY INDIGO */
  if (themeId === 'clay-indigo') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header with floating avatars */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffb562', fontWeight: 800 }}>
              SPLIT & LOG WORKOUT
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '2px 0 0 0', letterSpacing: '-0.5px' }}>
              Hey Marche! 👋
            </h2>
          </div>
          {/* Extruded avatar bubble — no flat surfaces, no borders */}
          <div className="clay-avatar-bubble" onClick={handleNavCoach} style={{ cursor: 'pointer' }}>
            <Sparkles size={22} color="#fce1b4" />
          </div>
        </div>

        {/* Recessed Search Pill — inset shadow only, no border */}
        <div className="clay-recessed-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} color="#ffb562" />
          <span style={{ fontSize: '13px', color: '#978ebd' }}>Search workout routines or friends...</span>
        </div>

        {/* Ticket Stub Hero Card — extruded, no borders, shadow-only */}
        <div className="clay-ticket-stub">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#2b2754', color: '#fce1b4', padding: '4px 10px', borderRadius: '12px' }}>
              TICKET #042 · TODAY
            </span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#745426' }}>45 mins</span>
          </div>

          <h3 style={{ fontSize: '22px', fontWeight: 900, margin: '4px 0 8px 0', color: '#2b2754' }}>
            Chest & Tricep Split
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', marginLeft: '6px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#6366f1', border: '2px solid #fce1b4', marginLeft: '-6px' }} />
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#ec4899', border: '2px solid #fce1b4', marginLeft: '-6px' }} />
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#10b981', border: '2px solid #fce1b4', marginLeft: '-6px' }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#634b28' }}>+3 gym partners logged</span>
          </div>

          {/* Dotted Divider */}
          <div style={{ borderTop: '2px dashed #d6b885', margin: '14px 0' }} />

          {/* Custom Clay Range Slider Track */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#2b2754', marginBottom: '6px' }}>
              <span>TARGET VOLUME</span>
              <span>3,200 kg</span>
            </div>
            <div className="clay-range-slider">
              <div className="clay-range-fill" style={{ width: '70%' }} />
              <div className="clay-range-handle" style={{ left: '70%' }} />
            </div>
          </div>

          <button 
            onClick={handleNavGym}
            style={{
              width: '100%',
              background: '#2b2754',
              color: '#fce1b4',
              border: 'none',
              padding: '14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Play size={16} fill="#fce1b4" /> START SPLIT WORKOUT SESSION
          </button>
        </div>

        {/* Horizontal Story Bubbles — extruded avatar rail */}
        <div>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#ffb562', letterSpacing: '1px' }}>
            GYM BUDDY ACTIVITY
          </span>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingTop: '10px' }}>
            {['Alex', 'Sarah', 'Mike', 'Elena'].map((name) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div className="clay-avatar-bubble" style={{ width: '54px', height: '54px' }}>
                  {name[0]}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#c4bddc' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* PROPOSAL 2: WARM LATTE EDITORIAL */
  if (themeId === 'warm-latte') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 60/40 vertical split: Editorial cover (top) */}
        <div style={{ flex: '0 0 60%', padding: '20px 20px 10px 20px', display: 'flex', flexDirection: 'column' }}>
          {/* Issue-number framing */}
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#f7f1e3', fontWeight: 800 }}>
            THE DAILY BLEND · ISSUE #04
          </span>
          {/* Serif headline */}
          <h2 className="latte-hero-serif" style={{ margin: '8px 0 16px 0' }}>
            {"Strength so strong it keeps you built."}
          </h2>

          {/* Featured Workout Card with bezel dial */}
          <div style={{ background: '#593e27', borderRadius: '28px', padding: '18px', color: '#f7f1e3', position: 'relative', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '10px', background: '#3e2a1b', color: '#e8dfce', padding: '4px 10px', borderRadius: '12px', fontWeight: 800 }}>
                  FLAVOUR OF THE DAY
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 4px 0', color: '#f7f1e3' }}>
                  Heavy Chest & Triceps
                </h3>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'serif', opacity: 0.4 }}>
                03
              </div>
            </div>

            {/* Bezel dial */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '16px 0' }}>
              <div className="latte-circle-bezel" style={{ width: '80px', height: '80px', margin: 0 }}>
                <Dumbbell size={32} color="#f7f1e3" />
              </div>
              <div style={{ fontSize: '12px', color: '#e8dfce', lineHeight: '1.4' }}>
                <div>⏱️ 45 Mins Duration</div>
                <div>🔥 3,200 kg Target Vol</div>
                <div>💪 4 Sets per Exercise</div>
              </div>
            </div>

            <button className="latte-attached-pill-btn" onClick={handleNavGym} style={{ width: '100%' }}>
              <span>BREW WORKOUT SESSION</span>
              <div className="latte-attached-badge">
                <ArrowRight size={18} />
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Sheet (40%) */}
        <div className="latte-bottom-sheet" style={{ flex: '0 0 40%', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#3e2a1b', textTransform: 'uppercase' }}>
              Your Progress Blend
            </span>
            <span style={{ fontSize: '11px', color: '#7a5839', fontWeight: 700 }}>View All</span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, background: '#f7f1e3', padding: '14px', borderRadius: '20px', border: '1px solid #d4c5b0' }}>
              <span style={{ fontSize: '11px', color: '#7a5839', fontWeight: 700 }}>WEEKLY VOL</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#3e2a1b', margin: '2px 0' }}>12.4k kg</div>
              <span style={{ fontSize: '10px', color: '#2e7d32', fontWeight: 800 }}>+12% increase</span>
            </div>
            <div style={{ flex: 1, background: '#f7f1e3', padding: '14px', borderRadius: '20px', border: '1px solid #d4c5b0' }}>
              <span style={{ fontSize: '11px', color: '#7a5839', fontWeight: 700 }}>BODY WEIGHT</span>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#3e2a1b', margin: '2px 0' }}>78.4 kg</div>
              <span style={{ fontSize: '10px', color: '#7a5839', fontWeight: 700 }}>Target 76.0 kg</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* PROPOSAL 3: ULTRA STEALTH DARK */
  if (themeId === 'dark-stealth') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header — white/gray/black only, no colored accents */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="stealth-title-huge" style={{ margin: 0 }}>Workouts</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleNavAdd}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#18181c', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={handleNavCoach}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#18181c', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Sparkles size={18} />
            </button>
          </div>
        </div>

        {/* Asymmetric Split Grid — negative space zones, no card borders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
          <div className="stealth-asymmetric-left">
            <div>
              <span style={{ fontSize: '11px', color: '#888894', fontWeight: 700 }}>CURRENT ROUTINE</span>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 12px 0', color: 'white' }}>Chest + Tricep</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stealth-circle-progress">
                <span>1</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>45 Mins</div>
                <button onClick={handleNavGym} style={{ background: 'white', color: 'black', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '11px', fontWeight: 800, marginTop: '4px', cursor: 'pointer' }}>
                  Start
                </button>
              </div>
            </div>
          </div>

          <div className="stealth-asymmetric-right">
            <span style={{ fontSize: '11px', color: '#888894', fontWeight: 700 }}>BODY WEIGHT</span>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'white', margin: '4px 0' }}>190 <span style={{ fontSize: '12px', color: '#888894' }}>lbs</span></div>
            <span style={{ fontSize: '10px', color: '#888894' }}>31 min ago</span>
          </div>
        </div>

        {/* Dot-Matrix Calendar — required element */}
        <div className="stealth-dot-matrix-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>WORKOUT CONSISTENCY</span>
            <span style={{ fontSize: '11px', color: '#888894' }}>2026 Q1</span>
          </div>

          <div className="stealth-dot-grid-3month">
            {['JAN', 'FEB', 'MAR'].map((month) => (
              <div key={month} className="stealth-dot-month">
                <span className="stealth-dot-month-title">{month}</span>
                <div className="stealth-dot-5x7">
                  {Array.from({ length: 20 }).map((_, idx) => (
                    <div key={idx} className={`stealth-dot ${idx % 3 === 0 ? 'active' : ''}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metric Tile */}
        <div style={{ background: '#16161c', borderRadius: '24px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#888894', fontWeight: 700 }}>VOLUME LIFTED (LAST 7 DAYS)</span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: 'white', margin: '2px 0 0 0' }}>3.200 <span style={{ fontSize: '14px', color: '#888894' }}>lbs</span></div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#25252e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="white" />
          </div>
        </div>
      </div>
    );
  }

  /* PROPOSAL 4: TACTICAL BLACK & AMBER GLASS */
  if (themeId === 'tactile-amber') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Hero Visual Card — semi-transparent, amber gradient border */}
        <div className="amber-hero-card">
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#ff6000', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            ● SESSION READY · IN TRANSIT
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '4px 0 12px 0', color: 'white' }}>
            Hypertrophy Chest & Triceps
          </h2>

          {/* Timeline Step Tracker */}
          <div className="amber-timeline-track">
            <div className="amber-timeline-node done" />
            <div className="amber-timeline-node done" />
            <div className="amber-timeline-node" />
            <div className="amber-timeline-node" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a0a5b5', fontWeight: 700 }}>
            <span>Warm Up</span>
            <span>Bench</span>
            <span>Triceps</span>
            <span>Finish</span>
          </div>
        </div>

        {/* Frosted Glass Stat Cards — no opaque cards, backdrop-filter + blur */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,96,0,0.15)', borderRadius: '20px', padding: '16px' }}>
            <span style={{ fontSize: '11px', color: '#a0a5b5', fontWeight: 700 }}>WEEKLY VOL</span>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '4px 0' }}>12.4k kg</div>
            <span style={{ fontSize: '10px', color: '#ff6000', fontWeight: 800 }}>+12% vs target</span>
          </div>
          <div style={{ background: 'rgba(30,33,40,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,96,0,0.15)', borderRadius: '20px', padding: '16px' }}>
            <span style={{ fontSize: '11px', color: '#a0a5b5', fontWeight: 700 }}>RECOVERY SCORE</span>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', margin: '4px 0' }}>88%</div>
            <span style={{ fontSize: '10px', color: '#ff6000', fontWeight: 800 }}>Recovered</span>
          </div>
        </div>

        {/* Pill CTA with attached circular badge */}
        <button className="amber-action-pill" onClick={handleNavGym}>
          <span>START TACTICAL GYM SESSION</span>
          <div className="amber-circle-badge">
            <ArrowRight size={18} color="white" />
          </div>
        </button>
      </div>
    );
  }

  /* PROPOSAL 5: SWISS BRUTALIST HIGH-CONTRAST */
  if (themeId === 'swiss-brutalist') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ALL CAPS header, 2px black border bottom */}
        <h1 className="swiss-header-huge">MONDAY</h1>

        {/* No rounded corners anywhere, 2px black borders, no shadows */}
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px solid #111' }}>
          {/* Active accordion row */}
          <div className="swiss-accordion-row" style={{ background: '#ffffff', padding: '16px', border: '2px solid #111', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 900, background: '#ff3b00', color: 'white', padding: '2px 6px' }}>ACTIVE</span>
              <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '4px 0 0 0' }}>CHEST + TRICEP HYPERTROPHY</h3>
            </div>
            <button 
              onClick={handleNavGym}
              style={{ background: '#111', color: 'white', border: 'none', padding: '10px 16px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', borderRadius: 0 }}
            >
              START →
            </button>
          </div>

          {/* Square Checklist Items — radius=0 checkboxes */}
          <div style={{ border: '2px solid #111', padding: '16px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>{"TODAY'S TARGETS"}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="swiss-square-checkbox checked">✓</div>
              <span className="swiss-task-completed" style={{ fontSize: '13px', fontWeight: 700 }}>Barbell Bench Press 4x8</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="swiss-square-checkbox"></div>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Incline Dumbbell Press 4x10</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="swiss-square-checkbox"></div>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Cable Tricep Pushdown 3x12</span>
            </div>
          </div>

          {['TUESDAY · REST', 'WEDNESDAY · BACK + BICEP', 'THURSDAY · LEGS'].map((day) => (
            <div key={day} className="swiss-accordion-row">
              <span style={{ fontSize: '14px', fontWeight: 900 }}>{day}</span>
              <span style={{ fontSize: '14px', fontWeight: 900 }}>+</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* PROPOSAL 6: EXTRUDED 3D NEUMORPHIC SLATE */
  if (themeId === 'neumorphic-slate') {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#8b96a5', fontWeight: 800, textTransform: 'uppercase' }}>SYSTEM STATE</span>
            <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '2px 0 0 0', color: '#e1e7ed' }}>
              MorphIQ Console
            </h2>
          </div>
          {/* Extruded control button — no borders, shadow-only */}
          <button className="neu-push-button-3d" onClick={handleNavCoach}>
            <Sparkles size={20} color="#ff5c00" />
          </button>
        </div>

        {/* Single hero focal point — extruded card with central dial */}
        <div className="neu-extruded-card-3d" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#8b96a5', fontWeight: 800 }}>WORKOUT CONTROL</span>
          <h3 style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0 20px 0', color: '#e1e7ed' }}>
            Chest & Tricep Power
          </h3>

          {/* Extruded control dial */}
          <button className="neu-dial-button-ember" onClick={handleNavGym}>
            <Play size={28} fill="white" style={{ marginLeft: '4px' }} />
          </button>

          {/* Recessed display well — inset for data display */}
          <div className="neu-recessed-well" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#ff5c00' }}>3,200</div>
              <div style={{ fontSize: '10px', color: '#8b96a5', fontWeight: 700 }}>TARGET KG</div>
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#dce3eb' }}>45m</div>
              <div style={{ fontSize: '10px', color: '#8b96a5', fontWeight: 700 }}>EST DURATION</div>
            </div>
          </div>
        </div>

        {/* Extruded stat cards — no flat surfaces, no borders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="neu-extruded-card-3d" style={{ padding: '16px' }}>
            <span style={{ fontSize: '10px', color: '#8b96a5', fontWeight: 800 }}>WEEKLY VOLUME</span>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#ff5c00', margin: '4px 0' }}>12.4k kg</div>
          </div>
          <div className="neu-extruded-card-3d" style={{ padding: '16px' }}>
            <span style={{ fontSize: '10px', color: '#8b96a5', fontWeight: 800 }}>BODY WEIGHT</span>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#dce3eb', margin: '4px 0' }}>78.4 kg</div>
          </div>
        </div>
      </div>
    );
  }

  /* PROPOSAL 7: MINIMALIST LIST-FIRST — No cards, no shadows, no bg fills, generous whitespace */
  if (themeId === 'list-first') {
    return (
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Date header */}
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#999999' }}>
            Monday, 15 July 2026
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', color: '#111111', letterSpacing: '-0.5px' }}>
            Good morning, Marche
          </h2>
        </div>

        {/* Today's workout — text-only line item with chevron */}
        <div className="list-first-item" onClick={handleNavGym} style={{ cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111111' }}>Today&apos;s workout</div>
            <div style={{ fontSize: '12px', color: '#999999', marginTop: '2px' }}>Chest & Tricep Hypertrophy · 45 min</div>
          </div>
          <ArrowRight size={18} color="#CCCCCC" />
        </div>

        {/* Quick actions — plain text links */}
        <div style={{ display: 'flex', gap: '32px', padding: '20px 0', borderBottom: '1px solid #EEEEEE' }}>
          <button 
            onClick={handleNavAdd}
            style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 600, color: '#3B82F6', cursor: 'pointer', padding: 0 }}
          >
            Log weight
          </button>
          <button 
            style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 600, color: '#3B82F6', cursor: 'pointer', padding: 0 }}
          >
            Add exercise
          </button>
        </div>

        {/* Progress section — labeled plain list */}
        <div className="list-first-section" style={{ marginTop: '24px' }}>
          <span className="list-first-section-title">This Week</span>
          <div className="list-first-item">
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>Volume lifted</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>12,400 kg</span>
          </div>
          <div className="list-first-item">
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>Workouts completed</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>4</span>
          </div>
          <div className="list-first-item">
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>Current body weight</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>78.4 kg</span>
          </div>
        </div>

        {/* Recovery section */}
        <div className="list-first-section">
          <span className="list-first-section-title">Recovery</span>
          <div className="list-first-item">
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>Sleep last night</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>7h 32m</span>
          </div>
          <div className="list-first-item">
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111111' }}>Resting HR</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111111' }}>58 bpm</span>
          </div>
        </div>

        {/* Text-only navigation */}
        <div className="list-first-nav">
          <span className="list-first-nav-item active">Today</span>
          <span className="list-first-nav-item">History</span>
          <span className="list-first-nav-item" onClick={handleNavCoach} style={{ cursor: 'pointer' }}>Coach</span>
          <span className="list-first-nav-item">Profile</span>
        </div>
      </div>
    );
  }

  /* PROPOSAL 8: GAMIFIED PLAYFUL — Saturated colors, progress ring, streaks, badges */
  if (themeId === 'gamified') {
    const ringRadius = 58;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringProgress = 0.68; /* 68% filled */
    const ringDashoffset = ringCircumference * (1 - ringProgress);

    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        {/* Header with level */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#A78BFA', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Level 12 · Power Builder
          </span>
          <h2 style={{ fontSize: '26px', fontWeight: 900, margin: '4px 0 0 0', color: '#FFFFFF' }}>
            Ready to crush it? 💪
          </h2>
        </div>

        {/* SVG Progress Ring — 68% filled */}
        <div className="game-progress-ring">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              className="game-progress-ring-bg"
              cx="70" cy="70" r={ringRadius}
            />
            <circle
              className="game-progress-ring-fill"
              cx="70" cy="70" r={ringRadius}
              style={{
                strokeDasharray: ringCircumference,
                strokeDashoffset: ringDashoffset,
              }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#22C55E' }}>68%</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#8B8CC7' }}>WEEKLY GOAL</span>
          </div>
        </div>

        {/* Streak Counter */}
        <div className="game-streak-banner" style={{ width: '100%' }}>
          <span>🔥</span>
          <span>7 Day Streak!</span>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>Keep it going!</span>
        </div>

        {/* XP Stats */}
        <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
          <div className="game-card" style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8B8CC7', fontWeight: 700 }}>XP EARNED</span>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#F59E0B', margin: '4px 0' }}>2,450</div>
          </div>
          <div className="game-card" style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8B8CC7', fontWeight: 700 }}>NEXT LEVEL</span>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#22C55E', margin: '4px 0' }}>550 XP</div>
          </div>
        </div>

        {/* Badge Grid — some locked */}
        <div style={{ width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#8B8CC7', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
            🏆 Achievements
          </span>
          <div className="game-badge-grid">
            <div className="game-badge" title="Early Riser">🌅</div>
            <div className="game-badge" title="Iron Will">🏋️</div>
            <div className="game-badge locked" title="Locked">🔒</div>
            <div className="game-badge locked" title="Locked">🔒</div>
          </div>
        </div>

        {/* Large bouncy pill button */}
        <button className="game-pill-btn" onClick={handleNavGym} style={{ width: '100%' }}>
          <Play size={20} fill="white" /> START WORKOUT +50 XP
        </button>
      </div>
    );
  }

  /* PROPOSAL 9: RETRO SKEUOMORPHIC — Chalkboard, taped index cards, handwritten font */
  if (themeId === 'retro') {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Chalkboard header with handwritten font */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span style={{ fontFamily: "'Caveat', cursive", fontSize: '14px', color: 'rgba(245,245,220,0.5)' }}>
            The Daily Logbook
          </span>
          <h2 style={{ 
            fontFamily: "'Caveat', cursive", 
            fontSize: '32px', 
            fontWeight: 700, 
            color: '#F5F5DC', 
            margin: '4px 0 0 0',
            letterSpacing: '1px',
          }}>
            Monday&apos;s Grind
          </h2>
        </div>

        {/* Chalk-drawn wavy divider */}
        <div className="retro-chalk-divider" />

        {/* Taped-on index card — workout plan */}
        <div className="retro-tape-card">
          <div className="retro-tape-piece" />
          <h3 style={{ 
            fontFamily: "'Caveat', cursive", 
            fontSize: '22px', 
            fontWeight: 700, 
            color: '#1A1A1A',
            margin: '0 0 8px 0',
          }}>
            Today&apos;s Battle Plan
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Dumbbell size={16} color="#1E40AF" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A' }}>Bench Press — 4 sets × 8 reps</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Dumbbell size={16} color="#1E40AF" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A' }}>Incline Dumbbell — 4 sets × 10</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Dumbbell size={16} color="#1E40AF" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A' }}>Tricep Pushdown — 3 sets × 12</span>
          </div>
          <button 
            onClick={handleNavGym}
            className="retro-doodle-timer"
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: '16px',
              fontWeight: 700,
              color: '#1E40AF',
              border: '2px dashed rgba(30,64,175,0.4)',
              borderRadius: '12px',
              padding: '6px 16px',
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-block',
              marginTop: '8px',
            }}
          >
            ✏️ Start Grinding!
          </button>
        </div>

        {/* Chalk-drawn wavy divider */}
        <div className="retro-chalk-divider" />

        {/* Taped-on index card — stats */}
        <div className="retro-tape-card">
          <div className="retro-tape-piece" />
          <h3 style={{ 
            fontFamily: "'Caveat', cursive", 
            fontSize: '20px', 
            fontWeight: 700, 
            color: '#1A1A1A',
            margin: '0 0 8px 0',
          }}>
            The Numbers
          </h3>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>WEEKLY VOL</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#1A1A1A' }}>12.4k kg</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>BODY WT</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#1A1A1A' }}>78.4 kg</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>STREAK</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#1A1A1A' }}>7 days</div>
            </div>
          </div>
        </div>

        {/* Chalk-drawn wavy divider */}
        <div className="retro-chalk-divider" />

        {/* Handwritten footer note */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ 
            fontFamily: "'Caveat', cursive", 
            fontSize: '16px', 
            color: 'rgba(245,245,220,0.5)',
          }}>
            &mdash; keep showing up, champ ✨
          </span>
        </div>
      </div>
    );
  }

  /* PROPOSAL 10: BENTO GRID — CSS grid, varied tile sizes, self-contained widgets */
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header — not a tile, spans top */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Dashboard
        </span>
        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1F2937', margin: '2px 0 0 0' }}>
          Welcome back, Marche
        </h2>
      </div>

      {/* Bento Grid — 4-column grid, varied tile sizes */}
      <div className="bento-grid">
        {/* 2×2 hero tile — workout of the day */}
        <div className="bento-tile bento-tile-lg" onClick={handleNavGym} style={{ cursor: 'pointer' }}>
          <span className="bento-tile-label">Today&apos;s Workout</span>
          <span className="bento-tile-title" style={{ marginTop: '4px' }}>Chest & Tricep Split</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
            <Play size={18} color="#4F46E5" fill="#4F46E5" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#4F46E5' }}>45 min · Start</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '16px' }}>
            <div>
              <div className="bento-tile-value" style={{ fontSize: '18px' }}>3,200</div>
              <span style={{ fontSize: '10px', color: '#6B7280' }}>kg target</span>
            </div>
            <div>
              <div className="bento-tile-value" style={{ fontSize: '18px' }}>4</div>
              <span style={{ fontSize: '10px', color: '#6B7280' }}>exercises</span>
            </div>
          </div>
        </div>

        {/* 2×1 wide tile — weekly volume */}
        <div className="bento-tile bento-tile-wide">
          <span className="bento-tile-label">Weekly Volume</span>
          <span className="bento-tile-value">12.4k kg</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <TrendingUp size={14} color="#22C55E" />
            <span className="bento-tile-subtle" style={{ color: '#22C55E' }}>+12% from last week</span>
          </div>
        </div>

        {/* 1×1 small tile — body weight */}
        <div className="bento-tile bento-tile-sm">
          <span className="bento-tile-label">Weight</span>
          <span className="bento-tile-value" style={{ fontSize: '18px' }}>78.4 kg</span>
          <span className="bento-tile-subtle">Target 76.0</span>
        </div>

        {/* 1×1 small tile — streak */}
        <div className="bento-tile bento-tile-sm">
          <span className="bento-tile-label">Streak</span>
          <span className="bento-tile-value" style={{ fontSize: '18px' }}>7 days</span>
          <span className="bento-tile-subtle">🔥 On fire</span>
        </div>

        {/* 2×1 wide tile — AI Coach */}
        <div className="bento-tile bento-tile-wide" onClick={handleNavCoach} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="bento-tile-label">AI Coach</span>
            <Sparkles size={16} color="#4F46E5" />
          </div>
          <span style={{ fontSize: '13px', color: '#374151', marginTop: '4px', display: 'block' }}>
            Ready for your next session? I&apos;ve got some tips for your bench press form.
          </span>
          <span style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', display: 'block' }}>
            Tap to chat →
          </span>
        </div>

        {/* 1×2 tall tile — recovery + sleep */}
        <div className="bento-tile bento-tile-tall">
          <span className="bento-tile-label">Recovery</span>
          <span className="bento-tile-value" style={{ fontSize: '20px' }}>88%</span>
          <span className="bento-tile-subtle">Ready to train</span>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #E5E7EB' }}>
            <span className="bento-tile-label">Sleep</span>
            <span className="bento-tile-value" style={{ fontSize: '18px' }}>7h 32m</span>
            <span className="bento-tile-subtle">Last night</span>
          </div>
        </div>
      </div>
    </div>
  );
};
