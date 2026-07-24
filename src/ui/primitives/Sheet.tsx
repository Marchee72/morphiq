import React, { useEffect, useState, useRef } from 'react';
import { registerBackHandler } from '../../presentation/state/backHandler';

import { lockBodyScroll, unlockBodyScroll } from './bodyScrollLock';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, children }) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const id = `sheet_${Date.now()}_${Math.random()}`;
    const unregister = registerBackHandler(id, () => {
      onClose();
    });

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    return () => {
      unlockBodyScroll();
      document.removeEventListener('keydown', onKey);
      unregister();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 90) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <div className="ui-sheet-overlay" data-testid="sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform var(--ui-motion)',
        }}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none', padding: 'var(--ui-space-1) 0 var(--ui-space-3)', cursor: 'grab' }}
        >
          <div className="ui-sheet-handle" />
          {title && <h2 className="ui-sheet-title" style={{ marginBottom: 0 }}>{title}</h2>}
        </div>
        {children}
      </div>
    </div>
  );
};
