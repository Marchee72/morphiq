import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Link2,
  Unlink,
  Plus,
  Edit2,
  Trash2,
  X,
  Dumbbell,
  Sparkles,
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
import { WorkoutExerciseStepper } from './WorkoutExerciseStepper';
import { ExerciseStatsBanner } from './ExerciseStatsBanner';
import { SetAdjustSheet } from './SetAdjustSheet';

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
    linkBiserieExercises,
    unlinkBiserieExercise,
    getExerciseStats,
  } = useStore();

  const [seconds, setSeconds] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  // Sheets & Dialog states
  const [dayNoteSheetOpen, setDayNoteSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [biseriePickerOpen, setBiseriePickerOpen] = useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);

  // Set Adjustment Sheet state
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
          const targetCount = ex.targetSets || 3;
          const stats = getExerciseStats(ex.exerciseName);
          for (let i = 1; i <= targetCount; i++) {
            const ghostWeight = stats?.lastSets?.[i - 1]?.weight ?? stats?.lastMaxWeight;
            autoSets.push({
              exerciseName: ex.exerciseName,
              exerciseId: ex.exerciseId,
              setNumber: i,
              weight: ex.targetWeight ?? ghostWeight ?? 0,
              reps: ex.targetReps ?? stats?.lastSets?.[i - 1]?.reps ?? 10,
              biserieGroupId: ex.biserieGroupId,
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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const id = `live_workout_${Date.now()}_${Math.random()}`;
    const unregister = registerBackHandler(id, () => {
      onClose();
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      unregister();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !activeSession) return;
    const updateSecs = () => {
      const elapsed = Math.floor((new Date().getTime() - activeSession.startTime.getTime()) / 1000);
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

  if (!isOpen) return null;

  const routineExercises = activeSession?.routineExercises || [];
  const currentExerciseItem = routineExercises[activeExerciseIndex];
  const currentExerciseName = currentExerciseItem?.exerciseName || 'Ejercicio Principal';

  const historicalStats = getExerciseStats(currentExerciseName);

  const totalVolumeKg = localSets.reduce(
    (sum, s) => (s.isCompleted ? sum + (s.weight || 0) * (s.reps || 0) : sum),
    0
  );

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentBiserieGroupId = currentExerciseItem?.biserieGroupId;
  const biseriePartnerIndex = currentBiserieGroupId
    ? routineExercises.findIndex(
        (ex, idx) => idx !== activeExerciseIndex && ex.biserieGroupId === currentBiserieGroupId
      )
    : -1;
  const biseriePartnerItem = biseriePartnerIndex !== -1 ? routineExercises[biseriePartnerIndex] : null;

  const partnerExerciseName = biseriePartnerItem?.exerciseName || '';
  const partnerHistoricalStats = useMemo(() => {
    return partnerExerciseName ? getExerciseStats(partnerExerciseName) : null;
  }, [getExerciseStats, partnerExerciseName]);

  const partnerExerciseSets = useMemo(() => {
    if (!partnerExerciseName) return [];
    return localSets
      .map((set, originalIndex) => ({ set, originalIndex }))
      .filter(({ set }) => set.exerciseName.trim().toLowerCase() === partnerExerciseName.trim().toLowerCase());
  }, [localSets, partnerExerciseName]);

  // Filter sets for current exercise
  const currentExerciseSets = localSets
    .map((set, originalIndex) => ({ set, originalIndex }))
    .filter(({ set }) => set.exerciseName.trim().toLowerCase() === currentExerciseName.trim().toLowerCase());

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
      biserieGroupId: currentBiserieGroupId,
      isCompleted: false,
    };

    const updated = [...localSets, newSet];
    setLocalSets(updated);
    updateActiveSessionSets(updated);
  };

  const handleAddSetForPartnerExercise = () => {
    if (!partnerExerciseName) return;
    const existingSets = partnerExerciseSets.map((item: { set: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'> }) => item.set);
    const lastSet = existingSets[existingSets.length - 1];

    const ghostWeight = partnerHistoricalStats?.lastSets?.[existingSets.length]?.weight;
    const ghostReps = partnerHistoricalStats?.lastSets?.[existingSets.length]?.reps;

    const newSet: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'> = {
      exerciseName: partnerExerciseName,
      exerciseId: biseriePartnerItem?.exerciseId,
      setNumber: existingSets.length + 1,
      weight: lastSet?.weight ?? biseriePartnerItem?.targetWeight ?? ghostWeight ?? 0,
      reps: lastSet?.reps ?? biseriePartnerItem?.targetReps ?? ghostReps ?? 10,
      biserieGroupId: currentBiserieGroupId,
      isCompleted: false,
    };

    const updated = [...localSets, newSet];
    setLocalSets(updated);
    updateActiveSessionSets(updated);
  };

  const handleDeleteSet = (originalIndex: number) => {
    const updated = localSets.filter((_, i) => i !== originalIndex);
    setLocalSets(updated);
    updateActiveSessionSets(updated);
  };

  const handleToggleCompleteSet = (index: number) => {
    const targetSet = localSets[index];
    const willBeCompleted = !targetSet.isCompleted;

    const updated = [...localSets];
    updated[index] = { ...targetSet, isCompleted: willBeCompleted };
    setLocalSets(updated);
    updateActiveSessionSets(updated);

    if (willBeCompleted) {
      setRestTimerSeconds(90);
    }
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
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'var(--ui-font)',
      }}
    >
      {/* Container */}
      <div
        style={{
          flex: 1,
          padding: '16px 16px 100px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* SAMSUNG HEALTH INTEGRATED HERO HEADER (BORDERLESS, NO CARD BOX) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
          {/* Top Bar Navigation */}
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
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: activeSession?.routineSource === 'coach' ? 'var(--ui-primary)' : 'var(--ui-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {activeSession?.routineSource === 'coach' ? (
                    <>
                      <Sparkles size={13} /> Rutina AI Coach
                    </>
                  ) : (
                    <>
                      <span className="ui-live-dot" /> Sesión En Curso
                    </>
                  )}
                </span>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
                  {activeSession?.workoutType || 'Gimnasio'}
                </h1>
              </div>
            </div>

            {/* Live Timer & Day Note Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDayNoteSheetOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 'var(--ui-radius-pill)',
                  background: activeFeelingMeta ? activeFeelingMeta.bg : 'var(--ui-surface)',
                  color: activeFeelingMeta ? activeFeelingMeta.color : 'var(--ui-text-primary)',
                  border: '1px solid var(--ui-outline)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--ui-font)',
                }}
              >
                <span>{activeFeelingMeta ? activeFeelingMeta.emoji : '📝'}</span>
                <span>{activeSession?.bodyNotes ? 'Nota Día' : 'Nota'}</span>
              </button>

              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ui-primary)', letterSpacing: '-0.5px' }}>
                {formatTimer(seconds)}
              </div>
            </div>
          </div>

          {/* Borderless Horizontal Metric Strip */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ui-text-secondary)', padding: '0 4px' }}>
            <span>🏋️ <strong>{localSets.filter((s) => s.isCompleted).length}</strong> series</span>
            <span>•</span>
            <span>⚡ <strong>{totalVolumeKg} kg</strong> vol.</span>
            {restTimerSeconds !== null && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--ui-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} /> Descanso: {formatTimer(restTimerSeconds)}
                </span>
              </>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button variant="tonal" onClick={() => setConfirmDismissOpen(true)} style={{ padding: '4px 12px', minHeight: 32, fontSize: 12, color: 'var(--ui-error)' }}>
                Descartar
              </Button>
              <Button variant="filled" onClick={handleFinishWorkout} style={{ padding: '4px 14px', minHeight: 32, fontSize: 12 }}>
                Finalizar Sesión
              </Button>
            </div>
          </div>
        </div>

        {/* Exercise Stepper Carousel */}
        <WorkoutExerciseStepper
          exercises={routineExercises}
          activeExerciseIndex={activeExerciseIndex}
          onSelectExerciseIndex={(idx) => setActiveExerciseIndex(idx)}
          onAddExerciseClick={() => setPickerOpen(true)}
          sets={localSets}
        />

        {/* Exercise Selection Guidance or Active Exercise Stats Banner */}
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
              Selecciona un ejercicio de tu biblioteca para comenzar a registrar series y cargas de tu entrenamiento.
            </p>
            <Button
              variant="filled"
              onClick={() => setPickerOpen(true)}
              style={{ marginTop: 4, minHeight: 44, padding: '0 24px' }}
            >
              <Plus size={18} /> Seleccionar Ejercicio de la Biblioteca
            </Button>
          </Card>
        ) : (
          <>
            {/* EXERCISE A STATS */}
            <ExerciseStatsBanner
              exerciseName={currentExerciseName}
              stats={historicalStats}
              biseriePartnerName={biseriePartnerItem?.exerciseName}
              isBiserieActive={Boolean(currentBiserieGroupId)}
              onChangeExerciseClick={() => setPickerOpen(true)}
              onToggleBiserieClick={() => {
                if (currentBiserieGroupId) {
                  unlinkBiserieExercise(currentExerciseItem?.id || '');
                } else {
                  setBiseriePickerOpen(true);
                }
              }}
            />

            {/* EXERCISE A SET LOGGER CARD */}
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>
                  Series — {currentExerciseName} ({currentExerciseSets.length} / {currentExerciseItem?.targetSets || 3} Obj)
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ui-primary)' }}>
                  Toca para editar
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
                          padding: '12px 16px',
                          borderRadius: 'var(--ui-radius-card)',
                          background: isDone ? 'var(--ui-success-bg)' : 'var(--ui-surface-dim)',
                          border: isDone ? '1.5px solid var(--ui-success)' : '1px solid var(--ui-outline)',
                          cursor: 'pointer',
                          transition: 'all var(--ui-motion-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: isDone ? 'var(--ui-success)' : 'var(--ui-primary)' }}>
                            Serie {setIdx + 1}
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
                            {set.weight && set.weight > 0 ? `${set.weight} kg` : 'Sin Peso'} × {set.reps ?? 10} reps
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Edit2 size={16} style={{ color: 'var(--ui-text-secondary)' }} />

                          <button
                            type="button"
                            aria-label="Eliminar serie"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSet(originalIndex);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', padding: 4 }}
                          >
                            <Trash2 size={16} />
                          </button>

                          <button
                            type="button"
                            aria-label={isDone ? 'Incompleto' : 'Completar serie'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCompleteSet(originalIndex);
                            }}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 'var(--ui-radius-pill)',
                              border: 'none',
                              background: isDone ? 'var(--ui-success)' : 'var(--ui-outline-strong)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddSetForCurrentExercise}
                style={{
                  width: '100%',
                  minHeight: 44,
                  borderRadius: 'var(--ui-radius-pill)',
                  border: '1.5px dashed var(--ui-primary)',
                  background: 'var(--ui-surface)',
                  color: 'var(--ui-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} /> Agregar Serie
              </button>
            </Card>

            {/* EXERCISE B (STOCKED DUAL VIEW IF BISERIE ACTIVE) */}
            {currentBiserieGroupId && biseriePartnerItem && (
              <>
                {/* Biserie Stack Divider */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--ui-radius-card)',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1.5px solid #8B5CF6',
                    margin: '6px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B5CF6', fontWeight: 800, fontSize: 13 }}>
                    <Link2 size={18} /> BISERIE EN PAREJA
                  </div>
                  <button
                    type="button"
                    onClick={() => unlinkBiserieExercise(currentExerciseItem?.id || '')}
                    style={{
                      background: 'none',
                      border: '1px solid #8B5CF6',
                      color: '#8B5CF6',
                      borderRadius: 'var(--ui-radius-pill)',
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Unlink size={12} /> Desvincular
                  </button>
                </div>

                {/* Exercise B Stats */}
                <ExerciseStatsBanner
                  exerciseName={biseriePartnerItem.exerciseName}
                  stats={partnerHistoricalStats}
                  biseriePartnerName={currentExerciseName}
                  isBiserieActive={true}
                  onChangeExerciseClick={() => {
                    setSwapIndex(biseriePartnerIndex);
                    setPickerOpen(true);
                  }}
                  onToggleBiserieClick={() => unlinkBiserieExercise(biseriePartnerItem.id || '')}
                />

                {/* Exercise B Set Logger Card */}
                <Card style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#8B5CF6' }}>
                      Series — {biseriePartnerItem.exerciseName} ({partnerExerciseSets.length} / {biseriePartnerItem.targetSets || 3} Obj)
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ui-primary)' }}>
                      Toca para editar
                    </span>
                  </div>

                  {partnerExerciseSets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--ui-text-secondary)', fontSize: 13 }}>
                      Sin series aún. Presiona "+ Agregar Serie".
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {partnerExerciseSets.map(({ set, originalIndex }: { set: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>; originalIndex: number }, setIdx: number) => {
                        const isDone = Boolean(set.isCompleted);
                        return (
                          <div
                            key={originalIndex}
                            onClick={() => setAdjustingSetIndex(originalIndex)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderRadius: 'var(--ui-radius-card)',
                              background: isDone ? 'var(--ui-success-bg)' : 'var(--ui-surface-dim)',
                              border: isDone ? '1.5px solid var(--ui-success)' : '1px solid #8B5CF6',
                              cursor: 'pointer',
                              transition: 'all var(--ui-motion-fast)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: isDone ? 'var(--ui-success)' : '#8B5CF6' }}>
                                Serie {setIdx + 1}
                              </span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ui-text-primary)' }}>
                                {set.weight && set.weight > 0 ? `${set.weight} kg` : 'Sin Peso'} × {set.reps ?? 10} reps
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Edit2 size={16} style={{ color: 'var(--ui-text-secondary)' }} />

                              <button
                                type="button"
                                aria-label="Eliminar serie"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSet(originalIndex);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', padding: 4 }}
                              >
                                <Trash2 size={16} />
                              </button>

                              <button
                                type="button"
                                aria-label={isDone ? 'Incompleto' : 'Completar serie'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCompleteSet(originalIndex);
                                }}
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 'var(--ui-radius-pill)',
                                  border: 'none',
                                  background: isDone ? 'var(--ui-success)' : '#8B5CF6',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <Check size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddSetForPartnerExercise}
                    style={{
                      width: '100%',
                      minHeight: 44,
                      borderRadius: 'var(--ui-radius-pill)',
                      border: '1.5px dashed #8B5CF6',
                      background: 'var(--ui-surface)',
                      color: '#8B5CF6',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} /> Agregar Serie ({biseriePartnerItem.exerciseName})
                  </button>
                </Card>
              </>
            )}
          </>
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

      {/* Set Adjust Keypad Sheet */}
      <SetAdjustSheet
        isOpen={adjustingSetIndex !== null}
        onClose={() => setAdjustingSetIndex(null)}
        setNumber={adjustingSetIndex !== null ? (currentExerciseSets.findIndex(s => s.originalIndex === adjustingSetIndex) + 1) : 1}
        exerciseName={currentExerciseName}
        initialWeight={adjustingSetIndex !== null ? (localSets[adjustingSetIndex]?.weight ?? 0) : 0}
        initialReps={adjustingSetIndex !== null ? (localSets[adjustingSetIndex]?.reps ?? 10) : 10}
        onSave={(weight, reps) => {
          if (adjustingSetIndex !== null) {
            handleUpdateSet(adjustingSetIndex, weight, reps, localSets[adjustingSetIndex]?.isCompleted);
          }
        }}
        onDelete={() => {
          if (adjustingSetIndex !== null) {
            handleDeleteSet(adjustingSetIndex);
          }
        }}
      />

      {/* Biserie Exercise Picker Sheet */}
      {biseriePickerOpen && (
        <div className="ui-sheet-overlay" onClick={() => setBiseriePickerOpen(false)}>
          <div className="ui-sheet" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ui-sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
                Vincular Biserie para {currentExerciseName}
              </h3>
              <button type="button" className="ui-icon-btn" onClick={() => setBiseriePickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routineExercises.map((ex, idx) => {
                if (idx === activeExerciseIndex) return null;
                return (
                  <button
                    key={ex.id || idx}
                    type="button"
                    onClick={() => {
                      if (currentExerciseItem?.id && ex.id) {
                        linkBiserieExercises(currentExerciseItem.id, ex.id);
                      }
                      setBiseriePickerOpen(false);
                    }}
                    className="ui-list-item"
                    style={{ padding: 12, borderRadius: 'var(--ui-radius-md)', background: 'var(--ui-surface-dim)', border: '1px solid var(--ui-outline)' }}
                  >
                    <div className="ui-list-item-icon">
                      <Link2 size={18} />
                    </div>
                    <div className="ui-list-item-text">
                      <span>{ex.exerciseName}</span>
                      <span className="ui-list-item-sub">Target: {ex.targetSets} series</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
