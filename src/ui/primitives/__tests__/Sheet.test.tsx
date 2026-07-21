import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Add food">Form</Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('renders a dialog with title and children when open', () => {
    render(<Sheet open onClose={() => {}} title="Add food">Form</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Add food' })).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
  });
  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.click(screen.getByTestId('sheet-overlay'));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('does not close when the sheet body is clicked', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
