import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendCard } from '../TrendCard';
import { SyncCard } from '../SyncCard';

describe('TrendCard', () => {
  it('shows a hint with fewer than 2 points', () => {
    render(<TrendCard points={[{ label: 'Mon', weight: 78 }]} />);
    expect(screen.getByText(/at least two measurements/i)).toBeInTheDocument();
  });
  it('renders the chart region with enough points', () => {
    render(<TrendCard points={[{ label: 'Mon', weight: 78 }, { label: 'Tue', weight: 77.8 }]} />);
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });
});

describe('SyncCard', () => {
  it('triggers onSync', () => {
    const onSync = vi.fn();
    render(<SyncCard state="idle" onSync={onSync} />);
    fireEvent.click(screen.getByRole('button', { name: /sync/i }));
    expect(onSync).toHaveBeenCalledOnce();
  });
  it('disables during sync', () => {
    render(<SyncCard state="syncing" onSync={() => {}} />);
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });
  it('shows success/error message', () => {
    const { rerender } = render(<SyncCard state="success" message="Synced 3" onSync={() => {}} />);
    expect(screen.getByText('Synced 3')).toBeInTheDocument();
    rerender(<SyncCard state="error" message="Denied" onSync={() => {}} />);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });
});
