import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';

const items = [
  { id: 'home', label: 'Home', icon: <span>H</span> },
  { id: 'gym', label: 'Gym', icon: <span>G</span> },
  { id: 'exercises', label: 'Exercises', icon: <span>E</span> },
  { id: 'coach', label: 'Coach', icon: <span>C</span> },
];

describe('BottomNav', () => {
  it('renders every item with its label', () => {
    render(<BottomNav items={items} activeId="home" onSelect={() => {}} />);
    for (const item of items) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
  });

  it('marks only the active item with aria-current', () => {
    render(<BottomNav items={items} activeId="gym" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Gym' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the tapped item id', () => {
    const onSelect = vi.fn();
    render(<BottomNav items={items} activeId="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    expect(onSelect).toHaveBeenCalledWith('exercises');
  });
});
