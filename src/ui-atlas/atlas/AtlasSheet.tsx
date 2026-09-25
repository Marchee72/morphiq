import React, { useId } from 'react';
import { motion, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { useT } from '../../i18n';
import { useDismissOnBack } from '../components/useDismissOnBack';

/** How far down, or how fast, a drag has to go before it closes the sheet rather than springing back. */
const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY = 600;

/**
 * Atlas's bottom sheet.
 *
 * The Android back button closes it (through the same LIFO stack the live
 * session uses), and so does Escape on the web — both from `useDismissOnBack`,
 * which the full-screen overlays share.
 *
 * It rises on a spring over a fading scrim, and drags down to close from the
 * grip or the header — not from the body, which scrolls. Short of the
 * threshold it springs back. Every sheet in the app inherits this.
 */
export const AtlasSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Rendered pinned at the bottom, outside the scrolling body. */
  footer?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer }) => {
  const { t } = useT();
  const titleId = useId();
  const drag = useDragControls();

  useDismissOnBack(open, onClose, 'sheet');

  if (!open) return null;

  const grab = (e: React.PointerEvent) => drag.start(e);

  return (
    <motion.div
      className="at-scrim"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <motion.div
        className="at-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY) onClose();
        }}
      >
        <div className="at-sheet-grip" aria-hidden="true" onPointerDown={grab} />
        <div className="at-sheet-head" onPointerDown={grab}>
          <div>
            {subtitle && <small>{subtitle}</small>}
            <h3 id={titleId} className="at-serif">{title}</h3>
          </div>
          <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>

        <div className="at-sheet-body">{children}</div>
        {footer && <div className="at-sheet-foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
};
