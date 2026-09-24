import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTabSwipe } from '../useTabSwipe';

function Pane({ enabled = true, onNext = vi.fn(), onPrev = vi.fn(), canPrev = true, canNext = true }: {
  enabled?: boolean; onNext?: () => void; onPrev?: () => void; canPrev?: boolean; canNext?: boolean;
}) {
  const swipe = useTabSwipe({ enabled, canPrev, canNext, onPrev, onNext });
  return (
    <div data-testid="pane" {...swipe.bind}>
      <button>tap</button>
      <div role="slider" aria-valuenow={0} tabIndex={0}>wheel</div>
    </div>
  );
}

const drag = (el: Element, dx: number, dy = 0) => {
  fireEvent.pointerDown(el, { clientX: 200, clientY: 300, pointerId: 1, timeStamp: 0 });
  fireEvent.pointerMove(el, { clientX: 200 + dx / 2, clientY: 300 + dy / 2, pointerId: 1, timeStamp: 100 });
  fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1, timeStamp: 400 });
  fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1, timeStamp: 400 });
};

describe('useTabSwipe', () => {
  it('changes tab past the threshold, in the direction of the swipe', async () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<Pane onNext={onNext} onPrev={onPrev} />);
    drag(screen.getByTestId('pane'), -120);
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    drag(screen.getByTestId('pane'), 120);
    await waitFor(() => expect(onPrev).toHaveBeenCalledTimes(1));
  });

  it('springs back from a short or mostly vertical drag', async () => {
    const onNext = vi.fn();
    render(<Pane onNext={onNext} />);
    drag(screen.getByTestId('pane'), -30);
    drag(screen.getByTestId('pane'), -90, 140);
    await new Promise(r => setTimeout(r, 50));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does nothing while disabled — Train during a session', async () => {
    const onNext = vi.fn();
    render(<Pane enabled={false} onNext={onNext} />);
    drag(screen.getByTestId('pane'), -200);
    await new Promise(r => setTimeout(r, 50));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('leaves a gesture that starts on a slider to the slider', async () => {
    const onNext = vi.fn();
    render(<Pane onNext={onNext} />);
    drag(screen.getByRole('slider'), -200);
    await new Promise(r => setTimeout(r, 50));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not pass the last tab', async () => {
    const onNext = vi.fn();
    render(<Pane canNext={false} onNext={onNext} />);
    drag(screen.getByTestId('pane'), -200);
    await new Promise(r => setTimeout(r, 50));
    expect(onNext).not.toHaveBeenCalled();
  });
});
