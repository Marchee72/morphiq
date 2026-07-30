import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();

/**
 * Today and Body at three data levels.
 *
 * Assertions read the rendered text of the whole screen rather than single
 * elements, so they survive markup changes and still prove the real derived
 * numbers reach the page.
 */
function visibleText(): string {
  return document.body.textContent?.replace(/\s+/g, ' ') ?? '';
}

describe('screens', () => {
  beforeEach(() => useStore.setState(initialState, true));

  describe('Today', () => {
    it('renders the body heat map with front/back toggle and no X/16 targets', () => {
      renderScreen('today');
      const text = visibleText();
      // The X/16 targets are gone — no "/16" or "/8" should appear.
      expect(text).not.toContain('/16');
      expect(text).not.toContain('/8');
      // The heat map card is present with its labels.
      expect(text).toContain('This week');
      expect(text).toContain('Last session');
      expect(text).toContain('Front');
      expect(text).toContain('Back');
    });

    it('shows the last session and goal nudge with rich data', () => {
      renderScreen('today', { data: 'rich' });
      const text = visibleText();
      // The fixture's last session is "Push A" with bench and row exercises.
      expect(text).toContain('Push A');
      expect(text).toContain('Barbell Bench Press');
      // The goal nudge and streak are present.
      expect(text).toMatch(/\d\/4/); // weeklyWorkoutGoalDays = 4
    });

    it('renders the heat map card with no history', () => {
      renderScreen('today', { data: 'empty' });
      const text = visibleText();
      expect(text).toContain('Last session');
      // No X/16 targets even with empty data.
      expect(text).not.toContain('/16');
    });

    it('offers a way to start when no session is running', () => {
      renderScreen('today', { data: 'empty' });
      expect(screen.getAllByRole('button', { name: /start/i }).length).toBeGreaterThan(0);
    });

    it('reports the weekly goal from the profile', () => {
      renderScreen('today', { data: 'rich' });
      expect(visibleText()).toMatch(/\d\/4/); // weeklyWorkoutGoalDays = 4
    });
  });

  describe('Body', () => {
    it('reports the latest weigh-in, not a bucket average', () => {
      renderScreen('body', { data: 'rich' });
      // Newest fixture reading is 82 − 11 × 0.3 = 78.7 kg.
      expect(visibleText()).toContain('78.7');
    });

    it('names the composition metrics it has data for', () => {
      renderScreen('body', { data: 'rich' });
      const text = visibleText();
      expect(text).toContain('Muscle mass');
      expect(text).toContain('Body fat');
    });

    it('invites a first reading instead of rendering an empty chart', () => {
      renderScreen('body', { data: 'empty' });
      expect(screen.getByText(/No weigh-ins yet/i)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /take a new reading/i }).length).toBeGreaterThan(0);
    });

    it('survives a history too short to compute a 30-day delta', () => {
      renderScreen('body', { data: 'sparse' });
      const text = visibleText();
      expect(text).toContain('79.8');
      // Two readings 18 days apart cannot support a 30-day comparison, and the
      // screen must say so rather than implying no change.
      expect(text).toMatch(/No data yet|—/);
    });
  });

  describe('language', () => {
    it('renders Spanish throughout when the language is set', () => {
      useStore.setState({ language: 'es' });
      renderScreen('body', { data: 'rich' });
      const text = visibleText();
      expect(text).toContain('Masa muscular');
      expect(text).not.toContain('Muscle mass');
    });

    it('formats numbers for the locale', () => {
      useStore.setState({ language: 'es' });
      renderScreen('body', { data: 'rich' });
      // Spanish uses a comma as the decimal separator.
      expect(visibleText()).toContain('78,7');
    });
  });
});
