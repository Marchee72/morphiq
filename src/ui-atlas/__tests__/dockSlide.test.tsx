import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AtlasNav } from '../atlas/AtlasNav';

/** jsdom has no layout: give each dock button a 60px slot, in order. */
function layOut() {
  screen.getAllByRole('button').forEach((b, i) => {
    b.getBoundingClientRect = () => ({ left: i * 60, right: i * 60 + 59, top: 0, bottom: 50, width: 59, height: 50, x: i * 60, y: 0, toJSON: () => ({}) });
  });
}

describe('AtlasNav', () => {
  it('scrubs through the tabs as a finger slides along it', () => {
    const onNavigate = vi.fn();
    render(<AtlasNav active="today" onNavigate={onNavigate} />);
    layOut();
    const dock = screen.getByRole('navigation');

    fireEvent.pointerDown(dock, { clientX: 20, pointerId: 1 });
    fireEvent.pointerMove(dock, { clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(dock, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(dock, { clientX: 200, pointerId: 1 });

    expect(onNavigate.mock.calls.map(c => c[0])).toEqual(['train', 'body']);
  });

  it('still changes tab on a plain tap, and a slide does not also tap', () => {
    const onNavigate = vi.fn();
    render(<AtlasNav active="today" onNavigate={onNavigate} />);
    layOut();
    fireEvent.click(screen.getByRole('button', { name: /coach/i }));
    expect(onNavigate).toHaveBeenLastCalledWith('coach');

    onNavigate.mockClear();
    const dock = screen.getByRole('navigation');
    fireEvent.pointerDown(dock, { clientX: 20, pointerId: 1 });
    fireEvent.pointerMove(dock, { clientX: 140, pointerId: 1 });
    fireEvent.pointerUp(dock, { clientX: 140, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /find|buscar/i }));
    // The slide already went to Find; the click it ends in is swallowed.
    expect(onNavigate.mock.calls.map(c => c[0])).toEqual(['library']);
  });
});
