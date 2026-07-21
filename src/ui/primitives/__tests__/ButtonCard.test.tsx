import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';
import { Card } from '../Card';

describe('Button', () => {
  it('renders the filled variant by default', () => {
    render(<Button>Start workout</Button>);
    expect(screen.getByRole('button', { name: 'Start workout' })).toHaveClass('ui-btn', 'ui-btn-filled');
  });

  it('applies tonal and outlined variant classes', () => {
    const { rerender } = render(<Button variant="tonal">Log</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-btn-tonal');
    rerender(<Button variant="outlined">Log</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-btn-outlined');
  });

  it('forwards click handlers and merges className', () => {
    const onClick = vi.fn();
    render(<Button className="extra" onClick={onClick}>Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('extra');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Card', () => {
  it('renders children inside a ui-card container', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toHaveClass('ui-card');
  });

  it('merges additional class names', () => {
    render(<Card className="hero">X</Card>);
    expect(screen.getByText('X')).toHaveClass('ui-card', 'hero');
  });
});
