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
    // 0–300 at 1.25 is 241 items; mounting them all stuttered on Android.
    const { container } = setup();
    const ticks = container.querySelectorAll('.at-dial-tick');
    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks.length).toBeLessThan(40);
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
});
