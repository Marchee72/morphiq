import React, { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import { useT } from '../../i18n';
import {
  canOfferInstall, canPrompt, isIos, onInstallabilityChange, promptInstall,
} from '../../data/pwa/install';

/**
 * Top-level install banner for web visitors.
 *
 * Prominently surfaces the "Install App" offer at the very top of the app frame
 * when visiting via browser on HTTPS (e.g. https://morphiq-eight.vercel.app).
 */
export const AtlasTopInstallBanner: React.FC = () => {
  const { t } = useT();
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('morphiq_install_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => onInstallabilityChange(() => force(n => n + 1)), []);

  if (dismissed || !canOfferInstall()) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('morphiq_install_banner_dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleInstallClick = async () => {
    if (canPrompt()) {
      const result = await promptInstall();
      if (result === 'accepted' || result === 'dismissed') {
        handleDismiss();
      }
    } else if (isIos()) {
      setShowIosSteps(prev => !prev);
    }
  };

  return (
    <div className="at-top-banner">
      <div className="at-top-banner-main">
        <div className="at-top-banner-icon">
          <Smartphone size={18} />
        </div>
        <div className="at-top-banner-text">
          <b>{t('install.title')}</b>
          <small>{t('install.topSubtitle')}</small>
        </div>
        <button className="at-btn at-btn-sm" onClick={handleInstallClick}>
          {canPrompt()
            ? t('install.action')
            : isIos()
              ? (showIosSteps ? t('common.close') : t('install.action'))
              : t('install.action')}
        </button>
        <button
          className="at-round-sm"
          onClick={handleDismiss}
          aria-label={t('common.close')}
        >
          <X size={14} />
        </button>
      </div>

      {isIos() && showIosSteps && (
        <div className="at-top-banner-ios">
          <small className="at-field-hint">{t('install.iosBody')}</small>
          <div className="at-install-steps">
            <span><Share size={14} /> {t('install.iosStep1')}</span>
            <span>{t('install.iosStep2')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
