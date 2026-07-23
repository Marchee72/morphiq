import React, { useState } from 'react';
import { Calendar, Clock, Flame, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import { Card } from '../../ui/primitives/Card';
import { Chip } from '../../ui/primitives/Chip';
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog';

export interface WorkoutHistoryCardProps {
  log: WorkoutLog;
  sets?: WorkoutSet[];
  onDelete?: (id: string) => void;
}

export const WorkoutHistoryCard: React.FC<WorkoutHistoryCardProps> = ({ log, sets = [], onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const dateStr = new Date(log.timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const durationStr = log.duration >= 60
    ? `${Math.floor(log.duration / 60)}h ${log.duration % 60}m`
    : `${log.duration}m`;

  return (
    <Card style={{ padding: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {log.type}
            </span>
            <Chip size="sm" selected={log.source === 'health-connect'}>
              {log.source === 'health-connect' ? 'Samsung Health' : 'Manual'}
            </Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginTop: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> {dateStr}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} /> {durationStr}
            </span>
            {log.caloriesBurned && log.caloriesBurned > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Flame size={13} style={{ color: 'var(--ui-error)' }} /> {log.caloriesBurned} kcal
              </span>
            )}
          </div>
        </div>

        {log.id && onDelete && (
          <button
            type="button"
            aria-label={`Delete ${log.type} workout`}
            onClick={() => setConfirmDeleteOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ui-error)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {log.description && (
        <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: '8px 0 0 0' }}>
          {log.description}
        </p>
      )}

      {/* Sets List Accordion */}
      {sets.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--ui-outline)', paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--ui-text-secondary)',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            <span>{sets.length} sets logged</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {sets.map((s, idx) => (
                <div
                  key={s.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    background: 'var(--ui-tonal)',
                    padding: '6px 10px',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: 11, color: 'var(--ui-on-tonal)', width: 18 }}>#{s.setNumber}</span>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.exerciseName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
                    {s.weight != null && s.weight > 0 && <span>{s.weight} kg</span>}
                    {s.reps != null && s.reps > 0 && <span>× {s.reps} reps</span>}
                    {s.distanceKm != null && s.distanceKm > 0 && <span>{s.distanceKm} km</span>}
                    {s.notes && (
                      <span title={s.notes} style={{ color: 'var(--ui-primary)', display: 'flex', alignItems: 'center' }}>
                        <FileText size={14} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Custom Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Workout Log?"
        message="Are you sure you want to delete this workout log? This action cannot be undone."
        confirmText="Delete Log"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (log.id && onDelete) onDelete(log.id);
          setConfirmDeleteOpen(false);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </Card>
  );
};
