import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';

/**
 * A copy button that answers: the icon blurs into a check, the label (when
 * shown) re-types itself letter by letter, and the button goes lime until it
 * resets on its own. After Watermelon's copy-confirm.
 *
 * `onCopy` resolves to whether anything was copied; a failed copy (no
 * clipboard over plain HTTP, some WebViews) just does not tick — an error
 * about it would be noise nobody can act on.
 */
export function CopyConfirm({ onCopy, label, copiedLabel, showLabel = false, className, ghost = true }: {
  onCopy: () => Promise<boolean>;
  label: string;
  copiedLabel: string;
  /** Icon-only by default; the visible label is for roomy places like the coach card. */
  showLabel?: boolean;
  className?: string;
  /** Rendered as an `.at-btn` ghost unless a caller styles it itself. */
  ghost?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const text = copied ? copiedLabel : label;
  return (
    <button
      type="button"
      className={className ?? 'at-btn'}
      data-ghost={ghost}
      data-copied={copied}
      onClick={() => void onCopy().then(ok => ok && setCopied(true))}
      aria-label={showLabel ? undefined : text}
      title={label}
      style={copied ? { background: 'var(--lime)', color: 'var(--lime-ink)', transition: 'background .3s ease, color .3s ease' } : { transition: 'background .3s ease, color .3s ease' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? 'check' : 'copy'}
          style={{ display: 'inline-flex' }}
          initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </motion.span>
      </AnimatePresence>
      {showLabel && (
        <span style={{ display: 'inline-flex' }} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            {text.split('').map((char, i) => (
              <motion.span
                key={`${text}-${i}`}
                initial={{ opacity: 0, y: 5, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.03 * i } }}
                exit={{ opacity: 0, y: -5, scale: 0.7 }}
                style={{ display: 'inline-block', whiteSpace: 'pre' }}
              >
                {char}
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      )}
    </button>
  );
}
