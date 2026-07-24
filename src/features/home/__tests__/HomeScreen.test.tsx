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

  it('renders energy score and category toolbar', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    // Energy Score card has a label "Energy Score" (uppercase via CSS) — match the ring label
    expect(screen.getAllByText(/energy score/i).length).toBeGreaterThan(0);
    // Category tabs
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nutrition/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /body/i })).toBeInTheDocument();
  });

  it('shows body category content (weight, body fat, trend)', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /body/i }));
    expect(screen.getByText('78.40')).toBeInTheDocument();
    expect(screen.getAllByText(/-0\.60/)[0]).toBeInTheDocument();
    expect(screen.getByText('18.20%')).toBeInTheDocument();
    expect(screen.getByText(/weight trend/i)).toBeInTheDocument();
  });

  it('shows activity category with sync', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    // Default is Activity
    expect(screen.getAllByText(/samsung health/i).length).toBeGreaterThan(0);
  });

  it('shows nutrition category with food log', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /nutrition/i }));
    expect(screen.getByText(/food today/i)).toBeInTheDocument();
  });

  it('greets the active profile', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    expect(screen.getByText(/alex/i)).toBeInTheDocument();
  });

  it('opens log-weight sheet from prop callback', async () => {
    const cb = vi.fn();
    render(<HomeScreen onOpenSettings={() => {}} onOpenWeightSheet={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /body/i }));
    fireEvent.click(screen.getByRole('button', { name: /log weight/i }));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('opens settings from gear', () => {
    const cb = vi.fn();
    render(<HomeScreen onOpenSettings={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(cb).toHaveBeenCalledOnce();
  });
});