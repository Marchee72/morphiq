import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { UndoAction } from '../time-undo-action';
import { M3Slider } from '../m3-slider';
import { Stepper } from '../stepper';
import { SlideToConfirm } from '../slide-to-confirm';
import { FluidTabs } from '../fluid-tabs';
import { LiquidToggle } from '../liquid-toggle';

afterEach(() => vi.useRealTimers());

describe('UndoAction', () => {
  it('commits once when the countdown runs out', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<UndoAction label="Discard" undoLabel="Undo" seconds={3} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    // A second at a time: each tick re-renders and schedules the next.
    const tick = () => act(() => { vi.advanceTimersByTime(1000); });
    tick(); tick();
    expect(onCommit).not.toHaveBeenCalled();
    tick();
    expect(onCommit).toHaveBeenCalledTimes(1);
    tick(); tick();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('does nothing when undone in time', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<UndoAction label="Discard" undoLabel="Undo" seconds={3} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    for (let i = 0; i < 5; i++) act(() => { vi.advanceTimersByTime(1000); });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });
});

function Controlled<T>({ initial, children }: { initial: T; children: (v: T, set: (v: T) => void) => React.ReactNode }) {
  const [v, set] = useState(initial);
  return <>{children(v, set)}</>;
}

describe('M3Slider', () => {
  it('moves by step with the keys and stays inside the range', () => {
    render(
      <Controlled initial={13}>
        {(v, set) => <M3Slider label="Effort" value={v} onChange={set} min={6} max={20} valueText={n => `${n} of 20`} />}
      </Controlled>,
    );
    const slider = screen.getByRole('slider', { name: 'Effort' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '14');
    expect(slider).toHaveAttribute('aria-valuetext', '14 of 20');
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '6');
  });
});

describe('Stepper', () => {
  it('steps within its bounds', () => {
    render(
      <Controlled initial={2}>
        {(v, set) => <Stepper value={v} onChange={set} min={1} max={3} unit="reps" decLabel="Fewer reps" incLabel="More reps" />}
      </Controlled>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More reps' }));
    expect(screen.getByRole('button', { name: 'More reps' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fewer reps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fewer reps' }));
    expect(screen.getByRole('button', { name: 'Fewer reps' })).toBeDisabled();
  });
});

describe('SlideToConfirm', () => {
  it('confirms from the keyboard, once', () => {
    const onConfirm = vi.fn();
    render(<SlideToConfirm label="Slide to finish" onConfirm={onConfirm} />);
    const knob = screen.getByRole('button', { name: 'Slide to finish' });
    fireEvent.keyDown(knob, { key: 'Enter' });
    fireEvent.keyDown(knob, { key: ' ' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('FluidTabs and LiquidToggle', () => {
  it('act as a radio group and a switch', () => {
    const onTab = vi.fn();
    const onToggle = vi.fn();
    render(
      <>
        <FluidTabs label="Range" options={[{ value: 'w', label: '7 days' }, { value: 'm', label: '30 days' }]} value="w" onChange={onTab} />
        <LiquidToggle label="Share" checked={false} onChange={onToggle} />
      </>,
    );
    expect(screen.getByRole('radio', { name: '7 days' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '30 days' }));
    expect(onTab).toHaveBeenCalledWith('m');
    fireEvent.click(screen.getByRole('switch', { name: 'Share' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
