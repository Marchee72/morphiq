import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen } from '../HomeScreen';
import { useStore } from '../../../presentation/state/store';
import { db } from '../../../data/database/LocalDatabase';
import type { Measurement } from '../../../core/entities/Measurement';

const initialState = useStore.getState();

function m(weight: number, daysAgo: number): Measurement {
  return { profileId: 'p1', timestamp: new Date(Date.now()-daysAgo*86400000), weight, impedance: 0, bmi: 24, bmr: 1800, bodyFat: 18.2, bodyWater: 55, boneMass: 3, muscleMass: 34.1, visceralFat: 8, metabolicAge: 30, protein: 18, bodyType: 4 };
}

describe('HomeScreen', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    useStore.setState({ activeProfile: { id: 'p1', name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date() }, measurements: [m(79, 5), m(78.4, 0)], foodLogs: [] });
  });

  it('renders weight hero, rings, food, trend, sync', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText(/-0\.6/)).toBeInTheDocument();
    expect(screen.getByText('18.2%')).toBeInTheDocument();
    expect(screen.getByText(/food today/i)).toBeInTheDocument();
    expect(screen.getByText(/weight trend/i)).toBeInTheDocument();
    expect(screen.getByText(/samsung health/i)).toBeInTheDocument();
  });

  it('greets the active profile', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    expect(screen.getByText(/alex/i)).toBeInTheDocument();
  });

  it('opens log-weight sheet and saves', async () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /log weight/i }));
    fireEvent.change(screen.getByPlaceholderText('78.4'), { target: { value: '78.1' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await screen.findByText('78.1');
    expect(useStore.getState().measurements.at(-1)?.weight).toBe(78.1);
  });

  it('opens settings from gear', () => {
    const cb = vi.fn();
    render(<HomeScreen onOpenSettings={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(cb).toHaveBeenCalledOnce();
  });
});
