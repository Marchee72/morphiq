import React, { useId } from 'react';
import { X } from 'lucide-react';
import { useT } from '../../i18n';
import { useDismissOnBack } from '../components/useDismissOnBack';

/**
 * Atlas's bottom sheet.
 *
 * Replaces the generic `Sheet` primitive, which was built for the pre-Atlas
 * token system. Beyond the styling it fixes two things that primitive never
 * had: the Android back button closes it (through the same LIFO stack the live
 * session uses), and Escape closes it on the web. Both now come from
 * `useDismissOnBack`, which the full-screen overlays share.
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

  useDismissOnBack(open, onClose, 'sheet');

  if (!open) return null;

  return (
    <div className="at-scrim" onClick={onClose}>
      <div
        className="at-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
      >
        <div className="at-sheet-grip" aria-hidden="true" />
        <div className="at-sheet-head">
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
      </div>
    </div>
  );
};
