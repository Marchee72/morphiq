import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from '../Chip';
import { ListItem } from '../ListItem';

describe('Chip', () => {
  it('reflects the selected state in its class', () => {
    const { rerender } = render(<Chip>Chest</Chip>);
    expect(screen.getByRole('button')).not.toHaveClass('ui-chip-selected');
    rerender(<Chip selected>Chest</Chip>);
    expect(screen.getByRole('button')).toHaveClass('ui-chip-selected');
  });
  it('forwards clicks', () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Back</Chip>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('ListItem', () => {
  it('renders title, subtitle, and trailing content', () => {
    render(<ListItem title="Barbell bench press" subtitle="Chest · Barbell" trailing={<span>›</span>} />);
    expect(screen.getByText('Barbell bench press')).toBeInTheDocument();
    expect(screen.getByText('Chest · Barbell')).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });
  it('renders the icon slot and forwards clicks', () => {
    const onClick = vi.fn();
    render(<ListItem title="Item" icon={<span data-testid="ico">★</span>} onClick={onClick} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
