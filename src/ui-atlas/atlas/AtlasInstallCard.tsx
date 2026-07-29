import React, { useEffect, useState } from 'react';
import { Share, Smartphone } from 'lucide-react';
import { useT } from '../../i18n';
import {
  canOfferInstall, canPrompt, isIos, onInstallabilityChange, promptInstall,
} from '../../data/pwa/install';

/**
 * The offer to install the web app to the home screen.
 *
 * Renders nothing at all inside the Android app, or once the app is already
 * running standalone — there is nothing left to install, and an offer that
 * cannot be taken up reads as a broken button.
 *
 * Two shapes, because the platforms genuinely differ: Chrome hands over a
 * prompt we can trigger, Safari has no API and has to be told what to tap.
 */
export const AtlasInstallCard: React.FC = () => {
  const { t } = useT();
  const [, force] = useState(0);
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | null>(null);

  // `beforeinstallprompt` can arrive after this has mounted, and does on a
  // first visit — without this the card never appears until something else
  // happens to re-render it.
  useEffect(() => onInstallabilityChange(() => force(n => n + 1)), []);

  if (!canOfferInstall()) return null;

  return (
    <div className="at-card at-settings-stack">
      <span className="at-field-label">{t('install.title')}</span>

      {canPrompt() ? (
        <>
          <small className="at-field-hint">{t('install.body')}</small>
          <button
            className="at-btn"
            style={{ justifyContent: 'center' }}
            onClick={async () => {
              const result = await promptInstall();
              if (result !== 'unavailable') setOutcome(result);
            }}
          >
            <Smartphone size={15} /> {t('install.action')}
          </button>
          {outcome === 'dismissed' && (
            <small className="at-field-hint">{t('install.dismissed')}</small>
          )}
        </>
      ) : isIos() ? (
        <>
          <small className="at-field-hint">{t('install.iosBody')}</small>
          <div className="at-install-steps">
            <span><Share size={14} /> {t('install.iosStep1')}</span>
            <span>{t('install.iosStep2')}</span>
          </div>
        </>
      ) : null}
    </div>
  );
};
