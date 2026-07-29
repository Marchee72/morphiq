import React, { useState } from 'react';
import { Copy, Check, Share2, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import { inviteHoursLeft, isInviteLive } from '../derive/social';
import { AtlasSheet } from './AtlasSheet';

/**
 * The code you send someone.
 *
 * Shown large and spaced, because it gets read off a screen and retyped on
 * another one. The alphabet it is drawn from already excludes the characters
 * people confuse; the letter-spacing is the other half of that.
 */
export const AtlasBuddyInvite: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t, tp, fmt } = useT();
  const { invite, createInvite, revokeInvite } = useSocial();
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);

  const now = new Date();
  const live = isInviteLive(invite, now);

  const link = invite ? `${window.location.origin}/?buddy=${invite.code}` : '';

  const run = async (task: () => Promise<void>) => {
    setWorking(true);
    try { await task(); } finally { setWorking(false); }
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the code is on screen anyway.
    }
  };

  const share = async () => {
    if (!invite) return;
    try {
      await navigator.share({
        text: t('buddy.inviteShareText', { code: invite.code }),
        url: link,
      });
    } catch {
      // Cancelling the share sheet throws. Not a failure.
    }
  };

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('buddy.invite')}
      subtitle={t('buddy.title')}
    >
      <p className="at-field-hint">{t('buddy.inviteSub')}</p>

      {live && invite ? (
        <>
          <div className="at-buddy-code">
            <span className="at-field-label">{t('buddy.inviteCode')}</span>
            <b>{invite.code}</b>
            <small>
              {tp('buddy.inviteExpires', inviteHoursLeft(invite, now))}
              {' · '}
              {fmt.dmy(invite.expiresAt)}
            </small>
          </div>

          <div className="at-buddy-actions">
            <button className="at-btn" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? t('buddy.inviteCopied') : t('buddy.inviteCopy')}
            </button>
            {/* Only where the platform actually has a share sheet — a button
                that throws on click is worse than one that is not there. */}
            {typeof navigator.share === 'function' && (
              <button className="at-btn" data-ghost="true" onClick={share}>
                <Share2 size={15} /> {t('buddy.inviteShare')}
              </button>
            )}
          </div>

          <small className="at-field-hint">{t('buddy.inviteAndroidNote')}</small>

          <div className="at-buddy-actions">
            <button
              className="at-btn"
              data-ghost="true"
              disabled={working}
              onClick={() => run(createInvite)}
            >
              {t('buddy.inviteRenew')}
            </button>
            <button
              className="at-chip"
              data-danger="true"
              disabled={working}
              onClick={() => run(revokeInvite)}
            >
              <Trash2 size={14} /> {t('buddy.inviteRevoke')}
            </button>
          </div>
          <small className="at-field-hint">{t('buddy.inviteRenewWarning')}</small>
        </>
      ) : (
        <>
          {invite && <small className="at-field-hint">{t('buddy.inviteExpired')}</small>}
          <button
            className="at-btn"
            style={{ justifyContent: 'center' }}
            disabled={working}
            onClick={() => run(createInvite)}
          >
            {t('buddy.inviteCreate')}
          </button>
        </>
      )}
    </AtlasSheet>
  );
};
