import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtlasTopInstallBanner } from '../atlas/AtlasTopInstallBanner';
import * as installModule from '../../data/pwa/install';

describe('AtlasTopInstallBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing when install cannot be offered', () => {
    const { container } = render(<AtlasTopInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders top install banner when install can be offered', () => {
    const canOfferSpy = typeof vi !== 'undefined' ? vi.spyOn(installModule, 'canOfferInstall').mockReturnValue(true) : null;
    const canPromptSpy = typeof vi !== 'undefined' ? vi.spyOn(installModule, 'canPrompt').mockReturnValue(true) : null;

    render(<AtlasTopInstallBanner />);

    expect(screen.getByText(/Install MorphIQ|Instalar MorphIQ/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Install app|Instalar app/i })).toBeTruthy();

    canOfferSpy?.mockRestore();
    canPromptSpy?.mockRestore();
  });

  it('dismisses banner when close button is clicked', () => {
    const canOfferSpy = typeof vi !== 'undefined' ? vi.spyOn(installModule, 'canOfferInstall').mockReturnValue(true) : null;

    render(<AtlasTopInstallBanner />);

    const closeBtn = screen.getByRole('button', { name: /close|cerrar/i });
    fireEvent.click(closeBtn);

    expect(sessionStorage.getItem('morphiq_install_banner_dismissed')).toBe('true');

    canOfferSpy?.mockRestore();
  });
});
