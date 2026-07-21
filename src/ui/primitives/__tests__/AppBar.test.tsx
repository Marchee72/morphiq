import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppBar } from '../AppBar';

describe('AppBar', () => {
  it('renders the title and optional overline', () => {
    render(<AppBar title="Today" overline="Good evening, Alex" />);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Good evening, Alex')).toBeInTheDocument();
  });

  it('starts expanded and collapses after scrolling past the threshold', () => {
    render(<AppBar title="Today" />);
    const header = screen.getByRole('banner');
    expect(header).not.toHaveClass('collapsed');

    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    fireEvent.scroll(window);
    expect(header).toHaveClass('collapsed');

    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    fireEvent.scroll(window);
    expect(header).not.toHaveClass('collapsed');
  });

  it('renders action content', () => {
    render(<AppBar title="Today" actions={<button>gear</button>} />);
    expect(screen.getByRole('button', { name: 'gear' })).toBeInTheDocument();
  });
});
