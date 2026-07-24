import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricHeroCard } from '../MetricHeroCard';
import { CompRingsCard } from '../CompRingsCard';

describe('MetricHeroCard', () => {
  it('shows the latest weight with unit', () => {
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={null} onLogWeight={() => {}} />);
    expect(screen.getByText('78.40')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });
  it('shows a signed delta', () => {
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={-0.6} onLogWeight={() => {}} />);
    expect(screen.getByText(/-0\.60/)).toBeInTheDocument();
  });
  it('shows an empty state without measurements', () => {
    render(<MetricHeroCard latestWeightKg={null} deltaKg={null} onLogWeight={() => {}} />);
    expect(screen.getByText(/no measurements yet/i)).toBeInTheDocument();
  });
  it('invokes onLogWeight', () => {
    const onLogWeight = vi.fn();
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={null} onLogWeight={onLogWeight} />);
    fireEvent.click(screen.getByRole('button', { name: /log weight/i }));
    expect(onLogWeight).toHaveBeenCalledOnce();
  });
});

describe('CompRingsCard', () => {
  it('renders body fat and muscle rings', () => {
    render(<CompRingsCard bodyFatPct={18.2} muscleMassKg={34.1} />);
    expect(screen.getByText('18.20%')).toBeInTheDocument();
    expect(screen.getByText('34.10')).toBeInTheDocument();
  });
  it('shows a sync hint when composition data is missing', () => {
    render(<CompRingsCard bodyFatPct={0} muscleMassKg={0} />);
    expect(screen.getByText(/samsung health/i)).toBeInTheDocument();
  });
});
