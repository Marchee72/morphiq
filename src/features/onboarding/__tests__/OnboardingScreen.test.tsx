import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingScreen } from '../OnboardingScreen';
import { useStore } from '../../../presentation/state/store';

const initialState = useStore.getState();

/**
 * The only path a new user has into the app. If this breaks, nobody gets in —
 * which is why it is covered before anything else in the screen.
 */
describe('OnboardingScreen', () => {
  beforeEach(() => {
    // Pin the language so assertions do not depend on the runner's locale.
    useStore.setState({ ...initialState, language: 'en' }, true);
  });

  const fill = ({ gender }: { gender: 'Male' | 'Female' }) => {
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('radio', { name: gender }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1995-01-01' } });
    fireEvent.change(screen.getByLabelText(/^height$/i), { target: { value: '180' } });
  };

  it('keeps the submit disabled until every field is filled', () => {
    render(<OnboardingScreen />);
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled();
    fill({ gender: 'Male' });
    expect(screen.getByRole('button', { name: /create profile/i })).toBeEnabled();
  });

  it('creates the profile with what was entered', () => {
    const createProfile = vi.fn().mockResolvedValue('1');
    useStore.setState({ createProfile });
    render(<OnboardingScreen />);

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Female' }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1992-05-10' } });
    fireEvent.change(screen.getByLabelText(/^height$/i), { target: { value: '168' } });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    expect(createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alex', gender: 'female', height: 168 }),
    );
  });

  it('rejects a height outside the plausible range', () => {
    render(<OnboardingScreen />);
    fill({ gender: 'Male' });
    fireEvent.change(screen.getByLabelText(/^height$/i), { target: { value: '12' } });
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled();
    expect(screen.getByText(/between 100 and 230/i)).toBeInTheDocument();
  });

  it('surfaces a failure instead of silently doing nothing', async () => {
    const createProfile = vi.fn().mockRejectedValue(new Error('Server connection failed'));
    useStore.setState({ createProfile });
    render(<OnboardingScreen />);
    fill({ gender: 'Male' });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    expect(await screen.findByText(/server connection failed/i)).toBeInTheDocument();
  });

  it('follows the language setting', () => {
    useStore.setState({ language: 'es' });
    render(<OnboardingScreen />);
    expect(screen.getByRole('button', { name: /crear perfil/i })).toBeInTheDocument();
  });
});
