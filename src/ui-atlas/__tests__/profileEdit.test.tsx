import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen, testProfile } from '../../test/renderScreen';
import type { UserProfile } from '../../core/entities/UserProfile';

/**
 * Correcting the profile after onboarding.
 *
 * Height was rendered on the settings card and editable nowhere: the edit sheet
 * offered name, target weight and weekly goal, so a figure typed wrong on day
 * one stayed wrong forever — and it is the input every body-composition number
 * in the app is derived from.
 *
 * `updateProfile` is stubbed rather than allowed to reach Dexie. What is under
 * test is what the sheet decides to save; the write itself belongs to
 * `LocalDatabase.test`, and going through it here only adds a fixture whose
 * auto-increment key has to agree with the store's.
 */

const initialState = useStore.getState();

let saved: UserProfile[];

async function openProfileEditor() {
  renderScreen('today', { data: 'empty' });
  useStore.setState({
    updateProfile: async (profile: UserProfile) => { saved.push(profile); },
  });

  fireEvent.click(await screen.findByRole('button', { name: /settings|ajustes/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^edit$|^editar$/i }));
  return await screen.findByLabelText(/height|altura/i);
}

const saveButton = () => screen.getByRole('button', { name: /^save$|^guardar$/i });

describe('editing the profile', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    saved = [];
  });

  it('offers the height, seeded from the profile', async () => {
    const height = await openProfileEditor();
    expect(height).toHaveValue(String(testProfile.height));
  });

  it('writes a corrected height through to the profile', async () => {
    const height = await openProfileEditor();
    fireEvent.change(height, { target: { value: '182' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].height).toBe(182);
  });

  it('takes a decimal comma, which is what the keyboard offers', async () => {
    const height = await openProfileEditor();
    fireEvent.change(height, { target: { value: '178,5' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].height).toBe(178.5);
  });

  it('refuses to save a height in metres', async () => {
    // 1.78 passes any "is it a positive number" check and quietly ruins every
    // BMI, BMR and body-fat figure the app derives.
    const height = await openProfileEditor();
    fireEvent.change(height, { target: { value: '1.78' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
    fireEvent.click(saveButton());

    expect(saved).toHaveLength(0);
    // And the rule is stated rather than left to be guessed at.
    expect(document.body.textContent).toMatch(/between 100 and 230|entre 100 y 230/i);
  });

  it('refuses an empty height rather than saving a zero', async () => {
    const height = await openProfileEditor();
    fireEvent.change(height, { target: { value: '' } });
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('leaves the other fields alone while saving the height', async () => {
    const height = await openProfileEditor();
    fireEvent.change(screen.getByLabelText(/^name$|^nombre$/i), { target: { value: 'Marche' } });
    fireEvent.change(height, { target: { value: '181' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      name: 'Marche',
      height: 181,
      // Untouched fields have to survive: the sheet spreads the existing
      // profile, and dropping one here would silently erase it.
      gender: testProfile.gender,
      weeklyWorkoutGoalDays: testProfile.weeklyWorkoutGoalDays,
    });
  });

  it('keeps the sheet honest about what it is showing', async () => {
    // A stale seed would offer the previous profile's height as if it were
    // this one's — the failure mode of initialising state before the load.
    const height = await openProfileEditor();
    expect(height).not.toHaveValue('');
    expect(Number((height as HTMLInputElement).value)).toBe(testProfile.height);
  });
});
