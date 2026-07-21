import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingScreen } from '../OnboardingScreen';
import { useStore } from '../../../presentation/state/store';

const initialState = useStore.getState();

describe('OnboardingScreen', () => {
  beforeEach(() => { useStore.setState(initialState, true); });

  it('disabled until filled', () => {
    render(<OnboardingScreen />);
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1995-01-01' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '180' } });
    expect(screen.getByRole('button', { name: /create profile/i })).toBeEnabled();
  });

  it('calls createProfile', () => {
    const createProfile = vi.fn().mockResolvedValue('1');
    useStore.setState({ createProfile });
    render(<OnboardingScreen />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1992-05-10' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '168' } });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alex', gender: 'female', height: 168 }));
  });
});
