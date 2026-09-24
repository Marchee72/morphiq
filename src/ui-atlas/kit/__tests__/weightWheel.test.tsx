import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeightWheel } from '../weight-wheel';
import { stepPlate, toPlate, zoneOf } from '../../derive/plates';

const BEST = 82.5 * (1 + 8 / 30); // 104.5 — Epley on 82,5 × 8

/** A wheel whose onChange feeds back, so a sequence of gestures sees its own results. */
function setup(value = 82.5, best: number | null = BEST) {
  const seen: number[] = [];
  const onChange = vi.fn((kg: number) => { seen.push(kg); view.rerender(ui(kg)); });
  const ui = (v: number) => <WeightWheel label="Weight" value={v} onChange={onChange} best={best} />;
  const view = render(ui(value));
  const wheel = screen.getByRole('slider', { name: 'Weight' });
  // jsdom has no layout: the wheel reports its 300-unit viewBox width as its box.
  wheel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 134, right: 300, bottom: 134, x: 0, y: 0, toJSON: () => ({}) });
  return { wheel, onChange, seen };
}

const onPlates = (kgs: number[]) => kgs.every(kg => Number.isInteger(kg / 2.5));

describe('plate maths', () => {
  it('rounds to the nearest 2,5 and never below zero', () => {
    expect(toPlate(81.25)).toBe(82.5);
    expect(toPlate(81.2)).toBe(80);
    expect(toPlate(-3)).toBe(0);
  });

  it('steps off the grid onto the neighbouring plate, not past it', () => {
    expect(stepPlate(81.25, 1)).toBe(82.5);
    expect(stepPlate(81.25, -1)).toBe(80);
    expect(stepPlate(80, 1)).toBe(82.5);
    expect(stepPlate(80, -1)).toBe(77.5);
    expect(stepPlate(0, -1)).toBe(0);
  });

  it('names the zone by share of the best', () => {
    expect(zoneOf(50, 100)).toBe('warmup');
    expect(zoneOf(60, 100)).toBe('volume');
    expect(zoneOf(75, 100)).toBe('strength');
    expect(zoneOf(85, 100)).toBe('heavy');
    expect(zoneOf(100, 100)).toBe('heavy');
    expect(zoneOf(102.5, 100)).toBe('record');
  });
});

describe('WeightWheel', () => {
  it('turns the wheel with the finger, a plate every 12 px, always on the grid', () => {
    const { wheel, seen } = setup();
    fireEvent.pointerDown(wheel, { clientX: 150, clientY: 30, pointerId: 1 });
    // Dragging left brings heavier plates up.
    fireEvent.pointerMove(wheel, { clientX: 90, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 90, clientY: 30, pointerId: 1 });
    expect(seen.at(-1)).toBe(95);
    fireEvent.pointerDown(wheel, { clientX: 150, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(wheel, { clientX: 186, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 186, clientY: 30, pointerId: 1 });
    expect(seen.at(-1)).toBe(87.5);
    expect(onPlates(seen)).toBe(true);
  });

  it('jumps to a tapped tick', () => {
    const { wheel, seen } = setup(95);
    // 45° right of the top is +12,5 kg.
    fireEvent.pointerDown(wheel, { clientX: 233, clientY: 59, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 233, clientY: 59, pointerId: 1 });
    expect(seen).toEqual([107.5]);
  });

  it('steps a plate with the keys and with − / +', () => {
    const { wheel, seen } = setup(80);
    fireEvent.keyDown(wheel, { key: 'ArrowRight' });
    fireEvent.keyDown(wheel, { key: 'ArrowRight' });
    fireEvent.keyDown(wheel, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: /increase|subir/i }));
    expect(seen).toEqual([82.5, 85, 82.5, 85]);
  });

  it('passes the 1RM without a stop or a jump, and calls it a record', () => {
    const { wheel, seen } = setup(100);
    for (let i = 0; i < 4; i++) fireEvent.keyDown(wheel, { key: 'ArrowRight' });
    expect(seen).toEqual([102.5, 105, 107.5, 110]);
    expect(screen.getByText(/record · \+5[.,]5 kg/i)).toBeInTheDocument();
  });

  it('shows the zone of the weight against the best', () => {
    setup(82.5);
    expect(screen.getByText(/strength/i)).toBeInTheDocument();
    expect(screen.getByText(/79% of your 1RM/)).toBeInTheDocument();
  });

  it('leaves zones out when there is no best to measure against', () => {
    setup(40, null);
    expect(screen.queryByText(/warm-up|volume|strength|heavy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/of your 1RM/)).not.toBeInTheDocument();
  });

  it('takes an exact weight off the grid when the number is tapped', () => {
    const { seen } = setup(80);
    fireEvent.click(screen.getByRole('button', { name: /weight: 80/i }));
    const input = screen.getByRole('textbox', { name: 'Weight' });
    fireEvent.change(input, { target: { value: '81,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Exact entry keeps the app's fraction grid (snapWeight), not the plate grid.
    expect(seen).toEqual([81.5]);
  });
});
