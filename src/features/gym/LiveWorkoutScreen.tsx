import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Trash2,
  Clock,
  Plus,
  Minus,
  Dumbbell,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  FileText,
} from 'lucide-react';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import { Button } from '../../ui/primitives/Button';
import { Card } from '../../ui/primitives/Card';
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog';
import { ExercisePickerSheet } from '../exercises/ExercisePickerSheet';
import { useStore } from '../../presentation/state/store';
import { cancelActiveWorkoutNotification } from '../../data/health/ActiveWorkoutNotification';
import { registerBackHandler } from '../../presentation/state/backHandler';
import { GymDayNoteSheet, FEELING_OPTIONS } from './GymDayNoteSheet';
import { ExerciseStatsBanner } from './ExerciseStatsBanner';
import { SetAdjustSheet } from './SetAdjustSheet';
import { lockBodyScroll, unlockBodyScroll } from '../../ui/primitives/bodyScrollLock';

export interface LiveWorkoutScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveWorkoutScreen: React.FC<LiveWorkoutScreenProps> = ({ isOpen, onClose }) => {
  const {
    activeSession,
    startActiveSession,
    finishActiveSession,
    dismissActiveSession,
    swapActiveSessionExercise,
    addActiveSessionExercise,
    updateActiveSessionSets,
    updateActiveSessionNote,
    getExerciseStats,
  } = useStore();

  const [seconds, setSeconds] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  // Single-accordion index for exercises in bottom breakdown (auto-collapses previous)
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState<number | null>(null);

  // Sheets & Dialog states
  const [dayNoteSheetOpen, setDayNoteSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);

  // Set Adjustment Modal (Slide-up Bottom Sheet)
  const [adjustingSetIndex, setAdjustingSetIndex] = useState<number | null>(null);

  // Rest Timer state
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null);

  // Local sets state mirror
  const [localSets, setLocalSets] = useState<Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>[]>([]);

  useEffect(() => {
    if (activeSession) {
      if (activeSession.sets && activeSession.sets.length > 0) {
        setLocalSets(activeSession.sets);
      } else if (
        (activeSession.routineSource === 'coach' || activeSession.routineSource === 'template') &&
        activeSession.routineExercises &&
        activeSession.routineExercises.length > 0
      ) {
        const autoSets: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>[] = [];
        for (const ex of activeSession.routineExercises) {
          const targetCount = ex.targetSets || 4;
          const stats = getExerciseStats(ex.exerciseName);
          for (let i = 1; i <= targetCount; i++) {
            const ghostWeight = stats?.lastSets?.[i - 1]?.weight ?? stats?.lastMaxWeight;
            autoSets.push({
              exerciseName: ex.exerciseName,
              exerciseId: ex.exerciseId,
              setNumber: i,
              weight: ex.targetWeight ?? ghostWeight ?? 0,
              reps: ex.targetReps ?? stats?.lastSets?.[i - 1]?.reps ?? 10,
              isCompleted: false,
            });
          }
        }
        setLocalSets(autoSets);
        updateActiveSessionSets(autoSets);
      }
    }
  }, [activeSession?.startTime, activeSession?.routineExercises, activeSession?.routineSource, getExerciseStats, updateActiveSessionSets]);

  useEffect(() => {
    if (isOpen && !activeSession) {
      startActiveSession('Strength Training');
    }
  }, [isOpen, activeSession, startActiveSession]);

  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();

    const id = `live_workout_${Date.now()}_${Math.random()}`;
    const unregister = registerBackHandler(id, () => {
      onClose();
    });

    return () => {
      unlockBodyScroll();
      unregister();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !activeSession) return;
    const updateSecs = () => {
      const startMs = activeSession.startTime ? new Date(activeSession.startTime).getTime() : Date.now();
      const elapsed = Math.floor((new Date().getTime() - startMs) / 1000);
      setSeconds(Math.max(0, elapsed));
    };
    updateSecs();
    const interval = setInterval(updateSecs, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeSession]);

  useEffect(() => {
    if (restTimerSeconds === null) return;
    if (restTimerSeconds <= 0) {
      setRestTimerSeconds(null);
      return;
    }
    const timer = setTimeout(() => {
      setRestTimerSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [restTimerSeconds]);

  const routineExercises = activeSession?.routineExercises || [];
  const currentExerciseItem = routineExercises[activeExerciseIndex];
  const currentExerciseName = currentExerciseItem?.exerciseName || 'Ejercicio Principal';

  const historicalStats = getExerciseStats(currentExerciseName);

  const totalVolumeKg = localSets.reduce(
    (sum, s) => (s.isCompleted ? sum + (s.weight || 0) * (s.reps || 0) : sum),
    0
  );

  const completedSetsCount = localSets.filter((s) => s.isCompleted).length;

  const totalTargetSets = useMemo(() => {
    if (routineExercises.length > 0) {
      return routineExercises.reduce((sum, ex) => sum + (ex.targetSets || 4), 0);
    }
    return Math.max(localSets.length, 1);
  }, [routineExercises, localSets]);

  const setProgressPct = Math.min(100, Math.round((completedSetsCount / totalTargetSets) * 100));

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filter sets for current exercise
  const currentExerciseSets = localSets
    .map((set, originalIndex) => ({ set, originalIndex }))
    .filter(({ set }) => set && set.exerciseName && currentExerciseName && set.exerciseName.trim().toLowerCase() === currentExerciseName.trim().toLowerCase());

  const handleUpdateSet = (
    index: number,
    weight?: number,
    reps?: number,
    isCompleted?: boolean,
    notes?: string
  ) => {
    const updated = [...localSets];
    updated[index] = {
      ...updated[index],
      weight,
      reps,
      isCompleted,
      notes,
    };
    setLocalSets(updated);
    updateActiveSessionSets(updated);
  };

  const handleAdjustTargetSets = (delta: number) => {
    if (!currentExerciseItem) return;
    const currentTarget = currentExerciseItem.targetSets || 4;
    const newTarget = Math.max(1, currentTarget + delta);

    if (activeSession && activeSession.routineExercises) {
      const updatedExercises = activeSession.routineExercises.map((ex, idx) =>
        idx === activeExerciseIndex ? { ...ex, targetSets: newTarget } : ex
      );
      useStore.setState({
        activeSession: {
          ...activeSession,
          routineExercises: updatedExercises,
        },
      });
    }
  };

  const handleAddSetForCurrentExercise = () => {
    const existingSets = currentExerciseSets.map((item) => item.set);
    const lastSet = existingSets[existingSets.length - 1];

    const ghostWeight = historicalStats?.lastSets?.[existingSets.length]?.weight;
    const ghostReps = historicalStats?.lastSets?.[existingSets.length]?.reps;

    const newSet: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'> = {
      exerciseName: currentExerciseName,
      exerciseId: currentExerciseItem?.exerciseId,
      setNumber: existingSets.length + 1,
      weight: lastSet?.weight ?? currentExerciseItem?.targetWeight ?? ghostWeight ?? 0,
      reps: lastSet?.reps ?? currentExerciseItem?.targetReps ?? ghostReps ?? 10,
      isCompleted: false,
    };

    const updated = [...localSets, newSet];
    setLocalSets(updated);
    updateActiveSessionSets(updated);

    // Open Bottom Sheet for the new set immediately
    setAdjustingSetIndex(updated.length - 1);
  };

  const handleDeleteSet = (originalIndex: number) => {
    const updated = localSets.filter((_, i) => i !== originalIndex);
    setLocalSets(updated);
    updateActiveSessionSets(updated);
  };

  const toggleExerciseExpand = (index: number) => {
    setExpandedExerciseIndex((prev) => (prev === index ? null : index));
  };

  const handleFinishWorkout = async () => {
    await cancelActiveWorkoutNotification();
    await finishActiveSession();
    onClose();
  };

  const handleConfirmDismiss = async () => {
    await cancelActiveWorkoutNotification();
    dismissActiveSession();
    setConfirmDismissOpen(false);
    onClose();
  };

  const activeFeelingMeta = FEELING_OPTIONS.find((f) => f.id === activeSession?.feelingTag);

  // SVG Ring Calculation (90px Compact Gauge)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * setProgressPct) / 100;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--ui-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        overscrollBehaviorY: 'contain',
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'var(--ui-font)',
      }}
    >
      {/* Main Screen Container */}
      <div
        style={{
          flex: 1,
          padding: '16px 16px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* TOP NAVIGATION BAR WITH COMPACT ICON ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              aria-label="Minimizar workout"
              onClick={onClose}
              className="ui-icon-btn"
              style={{ background: 'var(--ui-surface)', border: '1px solid var(--ui-outline)', width: 38, height: 38 }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: activeSession?.routineSource === 'coach' ? 'var(--ui-primary)' : 'var(--ui-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {activeSession?.routineSource === 'coach' ? (
                  <>
                    <Sparkles size={12} /> Rutina AI Coach
                  </>
                ) : (
                  <>
                    <span className="ui-live-dot" /> Sesión En Curso
                  </>
                )}
              </span>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
                {activeSession?.workoutType || 'Entrenamiento'}
              </h1>
            </div>
          </div>

          {/* COMPACT ICON-ONLY ACTION BUTTONS (NO TEXT) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              title="Finalizar Sesión"
              aria-label="Finalizar Sesión"
              onClick={handleFinishWorkout}
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--ui-radius-pill)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--ui-primary), #6366F1)',
                color: '#FFFFFF',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Check size={18} />
            </button>

            <button
              type="button"
              title="Descartar Sesión"
              aria-label="Descartar Sesión"
              onClick={() => setConfirmDismissOpen(true)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--ui-radius-pill)',
                border: '1px solid var(--ui-error)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--ui-error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* ULTRA COMPACT HORIZONTAL HERO HEADER */}
        <Card
          style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderRadius: 'var(--ui-radius-card)',
            background: 'radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.14), transparent 70%), var(--ui-surface)',
            border: '1px solid var(--ui-outline)',
            boxShadow: 'var(--ui-card-shadow)',
          }}
        >
          {/* Horizontal Layout: Timer Gauge (Left) + Stats & Note Trigger (Right) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Left: Compact 90px SVG Ring Gauge & Timer */}
            <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="45"
                  cy="45"
                  r={radius}
                  stroke="var(--ui-outline)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="45"
                  cy="45"
                  r={radius}
                  stroke="var(--ui-primary)"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>

              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ui-text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {formatTimer(seconds)}
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--ui-primary)', marginTop: 2 }}>
                  {setProgressPct}%
                </span>
              </div>
            </div>

            {/* Right: Vertical Stack (Volumen + Descanso + Nota Día) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              {/* Volumen & Descanso Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ background: 'var(--ui-surface-dim)', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--ui-outline)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Dumbbell size={14} style={{ color: 'var(--ui-primary)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'block', lineHeight: 1 }}>
                      Volumen
                    </span>
                    <strong style={{ fontSize: 12, fontWeight: 800, color: 'var(--ui-text-primary)', whiteSpace: 'nowrap' }}>
                      {totalVolumeKg.toFixed(2)} kg
                    </strong>
                  </div>
                </div>

                <div style={{ background: restTimerSeconds !== null ? 'rgba(59, 130, 246, 0.14)' : 'var(--ui-surface-dim)', padding: '6px 8px', borderRadius: 8, border: restTimerSeconds !== null ? '1px solid var(--ui-primary)' : '1px solid var(--ui-outline)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} style={{ color: restTimerSeconds !== null ? 'var(--ui-primary)' : 'var(--ui-text-secondary)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: restTimerSeconds !== null ? 'var(--ui-primary)' : 'var(--ui-text-secondary)', display: 'block', lineHeight: 1 }}>
                      Descanso
                    </span>
                    <strong style={{ fontSize: 12, fontWeight: 800, color: restTimerSeconds !== null ? 'var(--ui-primary)' : 'var(--ui-text-primary)', whiteSpace: 'nowrap' }}>
                      {restTimerSeconds !== null ? formatTimer(restTimerSeconds) : 'Inactivo'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Quick Rest Timer Controls if timer active */}
              {restTimerSeconds !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setRestTimerSeconds((prev) => (prev !== null ? prev + 30 : 30))}
                    style={{ background: 'var(--ui-surface-dim)', border: '1px solid var(--ui-outline)', borderRadius: 'var(--ui-radius-pill)', padding: '2px 6px', fontSize: 10, fontWeight: 700, color: 'var(--ui-primary)', cursor: 'pointer' }}
                  >
                    +30s
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestTimerSeconds((prev) => (prev !== null && prev > 30 ? prev - 30 : 0))}
                    style={{ background: 'var(--ui-surface-dim)', border: '1px solid var(--ui-outline)', borderRadius: 'var(--ui-radius-pill)', padding: '2px 6px', fontSize: 10, fontWeight: 700, color: 'var(--ui-text-secondary)', cursor: 'pointer' }}
                  >
                    -30s
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestTimerSeconds(null)}
                    style={{ background: 'var(--ui-surface-dim)', border: '1px solid var(--ui-outline)', borderRadius: 'var(--ui-radius-pill)', padding: '2px 6px', fontSize: 10, fontWeight: 700, color: 'var(--ui-error)', cursor: 'pointer' }}
                  >
                    Omitir
                  </button>
                </div>
              )}

              {/* Nota del Entrenamiento Trigger */}
              <button
                type="button"
                onClick={() => setDayNoteSheetOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 'var(--ui-radius-pill)',
                  background: activeFeelingMeta ? activeFeelingMeta.bg : 'var(--ui-surface-dim)',
                  color: activeFeelingMeta ? activeFeelingMeta.color : 'var(--ui-text-primary)',
                  border: '1px solid var(--ui-outline)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--ui-font)',
                  width: 'fit-content',
                }}
              >
                <span>{activeFeelingMeta ? activeFeelingMeta.emoji : '📝'}</span>
                <span>{activeSession?.bodyNotes ? 'Nota Día Registrada' : '+ Agregar Nota del Día'}</span>
              </button>
            </div>
          </div>

          {/* Series Progress Bar */}
          <div style={{ width: '100%', marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
              <span>Series Totales</span>
              <span><strong>{completedSetsCount}</strong> / {totalTargetSets} completadas</span>
            </div>
            <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'var(--ui-surface-dim)', overflow: 'hidden' }}>
              <div style={{ width: `${setProgressPct}%`, height: '100%', borderRadius: 999, background: 'var(--ui-primary)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </Card>

        {/* Empty State or Single Unified Active Exercise Card */}
        {routineExercises.length === 0 ? (
          <Card
            style={{
              padding: 24,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              borderRadius: 'var(--ui-radius-card)',
              background: 'var(--ui-surface)',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--ui-radius-md)',
                background: 'var(--ui-tonal)',
                color: 'var(--ui-on-tonal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dumbbell size={26} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
              No has seleccionado ningún ejercicio
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: 0, maxWidth: 360, lineHeight: 1.4 }}>
              Selecciona un ejercicio de tu biblioteca para comenzar a registrar series de tu entrenamiento.
            </p>
            <Button
              variant="filled"
              onClick={() => setPickerOpen(true)}
              style={{ marginTop: 4, minHeight: 48, padding: '0 24px', borderRadius: 'var(--ui-radius-pill)' }}
            >
              <Plus size={18} /> Seleccionar Ejercicio de la Biblioteca
            </Button>
          </Card>
        ) : (
          /* SINGLE UNIFIED ACTIVE EXERCISE CARD */
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
            {/* Embedded Exercise Stats Banner (Title, PR & Last Session) */}
            <ExerciseStatsBanner
              exerciseName={currentExerciseName}
              stats={historicalStats}
              onChangeExerciseClick={() => setPickerOpen(true)}
            />

            {/* Target Series Adjuster Stepper */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 'var(--ui-radius-md)',
                background: 'var(--ui-surface-dim)',
                border: '1px solid var(--ui-outline)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>
                Objetivo de Series
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => handleAdjustTargetSets(-1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--ui-radius-pill)',
                    border: '1px solid var(--ui-outline-strong)',
                    background: 'var(--ui-surface)',
                    color: 'var(--ui-text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Minus size={16} />
                </button>
                <strong style={{ fontSize: 14, fontWeight: 800, color: 'var(--ui-primary)' }}>
                  {currentExerciseItem?.targetSets || 4} series
                </strong>
                <button
                  type="button"
                  onClick={() => handleAdjustTargetSets(1)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--ui-radius-pill)',
                    border: '1px solid var(--ui-outline-strong)',
                    background: 'var(--ui-surface)',
                    color: 'var(--ui-text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Set List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>
                  Series Registradas ({currentExerciseSets.length})
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ui-primary)' }}>
                  Toca la fila para editar
                </span>
              </div>

              {currentExerciseSets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--ui-text-secondary)', fontSize: 13 }}>
                  Sin series aún. Presiona "+ Agregar Serie".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {currentExerciseSets.map(({ set, originalIndex }, setIdx) => {
                    const isDone = Boolean(set.isCompleted);
                    return (
                      <div
                        key={originalIndex}
                        onClick={() => setAdjustingSetIndex(originalIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 'var(--ui-radius-card)',
                          background: isDone ? 'var(--ui-success-bg)' : 'var(--ui-surface-dim)',
                          border: isDone ? '1.5px solid var(--ui-success)' : '1px solid var(--ui-outline)',
                          cursor: 'pointer',
                          transition: 'all var(--ui-motion-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: isDone ? 'var(--ui-success)' : 'var(--ui-primary)' }}>
                            Serie #{setIdx + 1}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
                            {set.weight && set.weight > 0 ? `${set.weight.toFixed(2)} kg` : 'Sin Peso'} × {set.reps ?? 10} reps
                          </span>
                          {set.notes && <FileText size={14} style={{ color: 'var(--ui-primary)' }} />}
                        </div>

                        {/* Status Label (Clean & Non-Intrusive) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isDone ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 'var(--ui-radius-pill)',
                                background: 'var(--ui-success)',
                                color: '#FFFFFF',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              <Check size={14} /> Completada
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--ui-primary)',
                                padding: '4px 8px',
                              }}
                            >
                              Cargar →
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons inside Unified Active Exercise Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleAddSetForCurrentExercise}
                style={{
                  width: '100%',
                  minHeight: 46,
                  borderRadius: 'var(--ui-radius-pill)',
                  border: '1.5px dashed var(--ui-primary)',
                  background: 'var(--ui-surface)',
                  color: 'var(--ui-primary)',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Agregar Serie ({currentExerciseName})
              </button>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={{
                  width: '100%',
                  minHeight: 44,
                  borderRadius: 'var(--ui-radius-pill)',
                  border: '1px solid var(--ui-outline)',
                  background: 'var(--ui-surface-dim)',
                  color: 'var(--ui-text-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Agregar Otro Ejercicio de la Biblioteca
              </button>
            </div>
          </Card>
        )}

        {/* BOTTOM SECTION: LISTA DE EJERCICIOS DE LA SESIÓN CON DETALLE EXPANDIBLE Y AUTOPLEGADO */}
        {routineExercises.length > 0 && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} style={{ color: 'var(--ui-primary)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
                  Ejercicios de la Sesión ({routineExercises.length})
                </h3>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ui-text-secondary)' }}>
                Toca para desplegar
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {routineExercises.map((exItem, exIdx) => {
                const isCurrent = exIdx === activeExerciseIndex;
                const exSets = localSets.filter(
                  (s) => s.exerciseName && s.exerciseName.trim().toLowerCase() === exItem.exerciseName.trim().toLowerCase()
                );
                const completedExSets = exSets.filter((s) => s.isCompleted).length;
                const totalExVolume = exSets.reduce(
                  (sum, s) => (s.isCompleted ? sum + (s.weight || 0) * (s.reps || 0) : sum),
                  0
                );
                const isExpanded = expandedExerciseIndex === exIdx;

                return (
                  <div
                    key={exItem.id || exIdx}
                    style={{
                      borderRadius: 'var(--ui-radius-card)',
                      background: isCurrent ? 'var(--ui-tonal)' : 'var(--ui-surface-dim)',
                      border: isCurrent ? '1.5px solid var(--ui-primary)' : '1px solid var(--ui-outline)',
                      overflow: 'hidden',
                      transition: 'all var(--ui-motion-fast)',
                    }}
                  >
                    {/* Header bar of exercise item */}
                    <div
                      onClick={() => toggleExerciseExpand(exIdx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--ui-radius-pill)',
                            background: completedExSets > 0 && completedExSets === exSets.length ? 'var(--ui-success-bg)' : 'var(--ui-surface)',
                            color: completedExSets > 0 && completedExSets === exSets.length ? 'var(--ui-success)' : 'var(--ui-primary)',
                            border: '1px solid var(--ui-outline)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {exIdx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ui-text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {exItem.exerciseName}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                            {completedExSets} / {exItem.targetSets || 4} series {totalExVolume > 0 && `• ${totalExVolume.toFixed(2)} kg`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveExerciseIndex(exIdx);
                            }}
                            style={{
                              background: 'var(--ui-primary)',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: 'var(--ui-radius-pill)',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Enfocar
                          </button>
                        )}
                        <div style={{ color: 'var(--ui-text-secondary)', padding: 4 }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Detailed sets accordion */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--ui-outline)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--ui-surface)' }}>
                        {exSets.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--ui-text-secondary)', textAlign: 'center', padding: '4px 0' }}>
                            Sin series registradas aún.
                          </span>
                        ) : (
                          exSets.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: 13,
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: s.isCompleted ? 'var(--ui-success-bg)' : 'var(--ui-surface-dim)',
                                border: s.isCompleted ? '1px solid var(--ui-success)' : '1px solid var(--ui-outline)',
                              }}
                            >
                              <span style={{ fontWeight: 800, color: 'var(--ui-text-primary)' }}>
                                Serie #{s.setNumber || sIdx + 1}
                              </span>
                              <span style={{ fontWeight: 800, color: s.isCompleted ? 'var(--ui-success)' : 'var(--ui-primary)' }}>
                                {s.weight && s.weight > 0 ? `${s.weight.toFixed(2)} kg` : 'Sin Peso'} × {s.reps ?? 10} reps {s.isCompleted ? '✓' : ''}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Day Note Bottom Sheet */}
      <GymDayNoteSheet
        isOpen={dayNoteSheetOpen}
        onClose={() => setDayNoteSheetOpen(false)}
        initialFeeling={activeSession?.feelingTag}
        initialNotes={activeSession?.bodyNotes}
        onSave={(feelingTag, notes) => {
          updateActiveSessionNote(feelingTag, notes);
        }}
      />

      {/* Catalog Exercise Picker Sheet */}
      <ExercisePickerSheet
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setSwapIndex(null);
        }}
        onSelect={(ex) => {
          if (swapIndex !== null) {
            swapActiveSessionExercise(swapIndex, ex);
            setSwapIndex(null);
          } else {
            const newIndex = routineExercises.length;
            addActiveSessionExercise(ex);
            setActiveExerciseIndex(newIndex);
          }
        }}
      />

      {/* Set Adjust Sheet (Slide-Up Bottom Sheet) */}
      <SetAdjustSheet
        isOpen={adjustingSetIndex !== null}
        onClose={() => setAdjustingSetIndex(null)}
        setNumber={adjustingSetIndex !== null ? (currentExerciseSets.findIndex(s => s.originalIndex === adjustingSetIndex) + 1) : 1}
        exerciseName={currentExerciseName}
        initialWeight={adjustingSetIndex !== null ? (localSets[adjustingSetIndex]?.weight ?? 0) : 0}
        initialReps={adjustingSetIndex !== null ? (localSets[adjustingSetIndex]?.reps ?? 10) : 10}
        onSave={(weight, reps) => {
          if (adjustingSetIndex !== null) {
            handleUpdateSet(adjustingSetIndex, weight, reps, true);
            setRestTimerSeconds(90);
          }
        }}
        onDelete={() => {
          if (adjustingSetIndex !== null) {
            handleDeleteSet(adjustingSetIndex);
          }
        }}
      />

      {/* Discard Confirmation Modal */}
      <ConfirmDialog
        open={confirmDismissOpen}
        title="Descartar Sesión de Gimnasio"
        message="¿Estás seguro de que deseas descartar la sesión actual? Se perderán todas las series registradas."
        confirmText="Descartar Sesión"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDismiss}
        onCancel={() => setConfirmDismissOpen(false)}
      />
    </div>
  );
};
