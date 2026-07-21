import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Ring } from '../Ring';
import { EmptyState } from '../EmptyState';

describe('Ring', () => {
  it('renders progress arc offset proportional to value', () => {
    const { container } = render(<Ring value={50} size={72} stroke={8} label="Fat" valueText="18%" />);
    const circles = container.querySelectorAll('circle');
    const radius = (72 - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(circles[1]).toHaveAttribute('stroke-dashoffset', String(circumference * 0.5));
  });
  it('clamps values above 100 to a full ring', () => {
    const { container } = render(<Ring value={140} size={72} stroke={8} />);
    const circles = container.querySelectorAll('circle');
    expect(circles[1]).toHaveAttribute('stroke-dashoffset', '0');
  });
  it('renders center label and value text', () => {
    render(<Ring value={66} label="Muscle" valueText="34.1" />);
    expect(screen.getByText('Muscle')).toBeInTheDocument();
    expect(screen.getByText('34.1')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, message, and icon', () => {
    render(<EmptyState icon={<span data-testid="eico">∅</span>} title="No data" message="Sync to get started" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Sync to get started')).toBeInTheDocument();
    expect(screen.getByTestId('eico')).toBeInTheDocument();
  });
  it('renders and activates an optional action', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={<button onClick={onClick}>Retry</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
