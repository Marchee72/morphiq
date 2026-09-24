import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AtlasMetricChart } from '../atlas/AtlasMetricChart';

const NOW = new Date(2026, 8, 24);

function chart() {
  const view = render(<AtlasMetricChart series={[80, 79.5, 79, 78.4]} decimals={1} now={NOW} weeks={4} />);
  const surface = view.container.querySelector('.at-chart') as HTMLElement;
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 90, right: 300, bottom: 90, x: 0, y: 0, toJSON: () => ({}) });
  return surface;
}

describe('AtlasMetricChart', () => {
  it('reads the week under the finger, and lets go with it', () => {
    const surface = chart();
    expect(screen.queryByRole('status')).toBeNull();

    // The right edge is this week.
    fireEvent.pointerDown(surface, { clientX: 296, pointerId: 1 });
    expect(screen.getByRole('status').textContent).toMatch(/78[.,]4/);

    // Dragging to the left edge reaches three weeks back.
    fireEvent.pointerMove(surface, { clientX: 4, pointerId: 1 });
    expect(screen.getByRole('status').textContent).toMatch(/80/);
    expect(screen.getByRole('status').textContent).toMatch(/3 Sept/);

    fireEvent.pointerUp(surface, { clientX: 4, pointerId: 1 });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
