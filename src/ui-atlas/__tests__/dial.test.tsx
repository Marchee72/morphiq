import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtlasDial } from '../atlas/AtlasDial';

const setup = (over: Partial<React.ComponentProps<typeof AtlasDial>> = {}) => {
  const onChange = vi.fn();
  const result = render(
    <AtlasDial
      label="Weight"
      value={40}
      onChange={onChange}
      min={0}
      max={300}
      step={1.25}
      suffix="kg"
      {...over}
    />,
  );
  return { onChange, ...result };
};

describe('AtlasDial', () => {
  it('shows the current value', () => {
    setup();
    expect(screen.getByRole('button', { name: /weight: 40/i })).toBeInTheDocument();
  });

  it('renders a window of values rather than the whole range', () => {
    // 0–300 at 1.25 is 241 items; mounting them all stuttered on Android. The
    // window is deliberately wide now — it is what caps a gesture — but it has
    // to stay a fraction of the range that stuttered.
    const { container } = setup();
    const ticks = container.querySelectorAll('.at-dial-tick');
    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks.length).toBeLessThan(100);
  });

  it('picks a value when a tick is tapped', () => {
    const { onChange, container } = setup();
    const tick = container.querySelector('.at-dial-tick:not([data-active="true"])') as HTMLElement;
    fireEvent.click(tick);
    expect(onChange).toHaveBeenCalledWith(Number(tick.dataset.value));
  });

  it('steps with the arrow keys', () => {
    const { onChange } = setup();
    const track = screen.getByRole('spinbutton');
    // The wheel is vertical, so up/down are the natural pair — right/left stay
    // bound for anyone whose muscle memory came from the horizontal version.
    fireEvent.keyDown(track, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(41.25);
    fireEvent.keyDown(track, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(38.75);
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(41.25);
  });

  it('jumps ten steps with page up and down', () => {
    const { onChange } = setup();
    const track = screen.getByRole('spinbutton');
    fireEvent.keyDown(track, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(52.5);
    fireEvent.keyDown(track, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(27.5);
  });

  it('reaches the ends of the range with home and end', () => {
    const { onChange } = setup();
    const track = screen.getByRole('spinbutton');
    fireEvent.keyDown(track, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(300);
    fireEvent.keyDown(track, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clamps a page jump rather than running past the range', () => {
    const { onChange } = setup({ value: 295 });
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(300);
  });

  describe('nudge buttons', () => {
    it('steps by exactly one increment', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /increase weight/i }));
      expect(onChange).toHaveBeenCalledWith(41.25);
      fireEvent.click(screen.getByRole('button', { name: /decrease weight/i }));
      expect(onChange).toHaveBeenCalledWith(38.75);
    });

    it('disables the one that would leave the range', () => {
      setup({ value: 0 });
      expect(screen.getByRole('button', { name: /decrease weight/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /increase weight/i })).not.toBeDisabled();
    });
  });

  it('exposes its range to assistive tech', () => {
    setup();
    const track = screen.getByRole('spinbutton');
    expect(track).toHaveAttribute('aria-valuenow', '40');
    expect(track).toHaveAttribute('aria-valuemin', '0');
    expect(track).toHaveAttribute('aria-valuemax', '300');
  });

  describe('keyboard entry', () => {
    it('turns into an input when the value is tapped', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      expect(screen.getByLabelText('Weight')).toHaveValue('40');
    });

    it('commits what was typed', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '82.5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(82.5);
    });

    it('snaps a typed value onto the step', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '83' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // 83 is not a multiple of 1.25; the nearest is 82.5.
      expect(onChange).toHaveBeenCalledWith(82.5);
    });

    it('accepts a comma as the decimal separator', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '82,5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(82.5);
    });

    it('clamps beyond the range instead of accepting it', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '9999' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(300);
    });

    it('discards nonsense rather than writing NaN', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('leaves the value alone on Escape', () => {
      const { onChange } = setup();
      fireEvent.click(screen.getByRole('button', { name: /weight: 40/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '120' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('formats reps without decimals', () => {
    setup({ label: 'Reps', value: 8, min: 1, max: 50, step: 1, suffix: undefined, decimals: 0 });
    expect(screen.getByRole('button', { name: /reps: 8$/i })).toBeInTheDocument();
  });

  /**
   * The weight dial as Train mounts it: the wheel walks whole kilos and the
   * fractions are chips. Before the split there were four rungs to the kilo and
   * a flick could not travel three of them — 60 kg measured twenty flicks.
   */
  const weight = (over: Partial<React.ComponentProps<typeof AtlasDial>> = {}) => setup({
    value: 60,
    min: 0,
    max: 300,
    step: 1,
    values: Array.from({ length: 301 }, (_, i) => i),
    fractions: [0, 0.125, 0.5, 0.75],
    formatValue: (v: number) => String(v),
    ...over,
  });

  describe('a wheel of whole kilos with fraction chips', () => {
    it('mounts tens of kilos either side, so one gesture can travel that far', () => {
      const { container } = weight();
      const ticks = Array.from(container.querySelectorAll<HTMLElement>('.at-dial-tick'));
      const mounted = ticks.map(tick => Number(tick.dataset.value));
      // Momentum stops where the DOM stops: the reach of a flick *is* this span.
      expect(Math.min(...mounted)).toBe(20);
      expect(Math.max(...mounted)).toBe(100);
    });

    it('keeps the full span mounted at the bottom of the ladder', () => {
      // Clamping both edges independently halved the window at 0 kg — [0, 40],
      // so 0 → 60 was two flicks where 20 → 80 was one. The window slides at
      // the ends rather than shrinking; it is the same 81 rows either way.
      const { container } = weight({ value: 0 });
      const mounted = Array.from(container.querySelectorAll<HTMLElement>('.at-dial-tick'))
        .map(tick => Number(tick.dataset.value));
      expect(Math.min(...mounted)).toBe(0);
      expect(Math.max(...mounted)).toBe(80);
      expect(mounted).toContain(60);
    });

    it('keeps the full span mounted at the top of the ladder too', () => {
      const { container } = weight({ value: 300 });
      const mounted = Array.from(container.querySelectorAll<HTMLElement>('.at-dial-tick'))
        .map(tick => Number(tick.dataset.value));
      expect(Math.min(...mounted)).toBe(220);
      expect(Math.max(...mounted)).toBe(300);
    });

    it('lands 40 kg away in one move, not three', () => {
      const { onChange, container } = weight();
      const far = container.querySelector<HTMLElement>('.at-dial-tick[data-value="100"]')!;
      fireEvent.click(far);
      expect(onChange).toHaveBeenCalledWith(100);
    });

    it('adds the chosen fraction to the kilo on the wheel', () => {
      const { onChange } = weight();
      fireEvent.click(screen.getByRole('button', { name: 'Fraction 0.5' }));
      expect(onChange).toHaveBeenCalledWith(60.5);
    });

    it('lights the chip the current value already carries', () => {
      weight({ value: 60.5 });
      expect(screen.getByRole('button', { name: 'Fraction 0.5' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Fraction 0' })).toHaveAttribute('aria-pressed', 'false');
      // The wheel is on the kilo; the fraction is not its business.
      expect(screen.getByRole('button', { name: /weight: 60.5/i })).toBeInTheDocument();
    });

    it('keeps the fraction when the wheel moves, so it is chosen once', () => {
      const { onChange, container } = weight({ value: 60.5 });
      fireEvent.click(container.querySelector<HTMLElement>('.at-dial-tick[data-value="80"]')!);
      expect(onChange).toHaveBeenCalledWith(80.5);
    });

    it('nudges a whole kilo, carrying the fraction along', () => {
      const { onChange } = weight({ value: 60.5 });
      fireEvent.click(screen.getByRole('button', { name: /increase weight/i }));
      expect(onChange).toHaveBeenCalledWith(61.5);
    });

    it('still snaps a typed value onto the allowed ladder', () => {
      const { onChange } = weight();
      fireEvent.click(screen.getByRole('button', { name: /weight: 60/i }));
      const input = screen.getByLabelText('Weight');
      // Typing stays the fast lane for an odd number, and 22.5 is on the ladder
      // even though the wheel alone would only offer 22 and 23.
      fireEvent.change(input, { target: { value: '22,5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(22.5);
    });

    it('snaps a typed value that is off the ladder to the nearest rung', () => {
      const { onChange } = weight();
      fireEvent.click(screen.getByRole('button', { name: /weight: 60/i }));
      const input = screen.getByLabelText('Weight');
      fireEvent.change(input, { target: { value: '80.3' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // Same answer `snapWeight` gives, which is what the store will hold.
      expect(onChange).toHaveBeenCalledWith(80.125);
    });

    it('leaves reps alone — no chips where there are no fractions', () => {
      const { container } = setup({ label: 'Reps', value: 8, min: 1, max: 50, step: 1 });
      expect(container.querySelector('.at-dial-fractions')).toBeNull();
    });
  });
});
