import React, { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import { isCompleteCode, normalizeInviteCode } from '../derive/social';
import { AtlasSheet } from './AtlasSheet';
import { AtlasInput } from './AtlasField';

/**
 * Turning somebody's code into a friendship.
 *
 * The server answers "expired", "already used" and "never existed" with one
 * status on purpose, so this screen has one message for all three. Telling them
 * apart would tell someone guessing which of their guesses were real codes.
 */
export const AtlasBuddyRedeem: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Arrives from an invite link, so the common path needs no typing. */
  initialCode?: string;
}> = ({ open, onClose, initialCode }) => {
  const { t } = useT();
  const { redeemInvite } = useSocial();
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode(normalizeInviteCode(initialCode ?? ''));
      setError(null);
    }
  }, [open, initialCode]);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      await redeemInvite(code);
      onClose();
    } catch (err) {
      setError(messageFor((err as Error).message));
    } finally {
      setWorking(false);
    }
  };

  /**
   * The server's wording is for a developer reading a log; this picks the one
   * the person holding the phone can act on.
   */
  function messageFor(raw: string): string {
    if (raw.includes('your own')) return t('buddy.redeemOwn');
    if (raw.includes('Too many attempts')) return t('buddy.redeemTooMany');
    if (raw.includes('Too many partners')) return t('buddy.redeemFull');
    return t('buddy.redeemInvalid');
  }

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('buddy.redeem')}
      subtitle={t('buddy.title')}
      footer={
        <button
          className="at-btn"
          style={{ justifyContent: 'center' }}
          disabled={working || !isCompleteCode(code)}
          onClick={submit}
        >
          {working ? t('buddy.redeemWorking') : t('buddy.redeemAction')}
        </button>
      }
    >
      <p className="at-field-hint">{t('buddy.redeemSub')}</p>

      <AtlasInput
        label={t('buddy.redeemPlaceholder')}
        value={code}
        // Normalised on every keystroke rather than validated on submit: a
        // pasted code arrives with spaces and dashes, and rejecting it teaches
        // nobody which character was the problem.
        onChange={value => { setCode(normalizeInviteCode(value)); setError(null); }}
        autoFocus
      />

      {error && <span className="at-buddy-error">{error}</span>}
    </AtlasSheet>
  );
};
