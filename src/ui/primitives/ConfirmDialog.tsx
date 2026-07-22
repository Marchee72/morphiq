import React, { useEffect } from 'react';
import { Button } from './Button';
import { registerBackHandler } from '../../presentation/state/backHandler';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;

    const id = `confirm_${Date.now()}_${Math.random()}`;
    const unregister = registerBackHandler(id, () => {
      onCancel();
    });

    return () => {
      unregister();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="ui-sheet-overlay" style={{ zIndex: 120 }} onClick={onCancel}>
      <div
        className="ui-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'calc(100% - 32px)',
          maxWidth: 400,
          margin: 'auto',
          padding: 'var(--ui-space-5)',
          borderRadius: 'var(--ui-radius-sheet)',
          background: 'var(--ui-surface)',
          border: '1px solid var(--ui-outline)',
          boxShadow: 'var(--ui-shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ui-space-3)',
          animation: 'ui-sheet-up var(--ui-motion)',
        }}
      >
        <h3 style={{ fontSize: 'var(--ui-text-headline)', fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 'var(--ui-text-body)', color: 'var(--ui-text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--ui-space-3)', justifyContent: 'flex-end', marginTop: 'var(--ui-space-2)' }}>
          <Button variant="tonal" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant="filled"
            size="sm"
            onClick={onConfirm}
            style={{
              background: variant === 'danger' ? 'var(--ui-error)' : undefined,
              color: variant === 'danger' ? 'var(--ui-on-primary)' : undefined,
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
