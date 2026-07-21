import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FoodTodayCard } from '../FoodTodayCard';
import { AddFoodSheet } from '../AddFoodSheet';
import { LogWeightSheet } from '../LogWeightSheet';
import type { FoodLog } from '../../../core/entities/FoodLog';

const logs: FoodLog[] = [
  { id: '1', profileId: 'p1', timestamp: new Date(), mealType: 'breakfast', description: 'Oats', calories: 350, protein: 12, carbs: 60, fat: 7 },
  { id: '2', profileId: 'p1', timestamp: new Date(), mealType: 'lunch', description: 'Chicken bowl', calories: 620, protein: 45, carbs: 55, fat: 18 },
];

describe('FoodTodayCard', () => {
  it('lists entries with a total calorie sum', () => {
    render(<FoodTodayCard logs={logs} onDelete={() => {}} onAdd={() => {}} />);
    expect(screen.getByText('Oats')).toBeInTheDocument();
    expect(screen.getByText('Chicken bowl')).toBeInTheDocument();
    expect(screen.getByText('970')).toBeInTheDocument();
  });
  it('shows an empty state', () => {
    render(<FoodTodayCard logs={[]} onDelete={() => {}} onAdd={() => {}} />);
    expect(screen.getByText(/nothing logged/i)).toBeInTheDocument();
  });
  it('calls onDelete', () => {
    const onDelete = vi.fn();
    render(<FoodTodayCard logs={logs} onDelete={onDelete} onAdd={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(onDelete).toHaveBeenCalledWith('1');
  });
  it('calls onAdd', () => {
    const onAdd = vi.fn();
    render(<FoodTodayCard logs={[]} onDelete={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /add food/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('AddFoodSheet', () => {
  it('submits parsed values with meal type', () => {
    const onSubmit = vi.fn();
    render(<AddFoodSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Protein shake' } });
    fireEvent.change(screen.getByLabelText(/calories/i), { target: { value: '220' } });
    fireEvent.change(screen.getByLabelText(/protein/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/carbs/i), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/fat/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lunch' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith({ mealType: 'lunch', description: 'Protein shake', calories: 220, protein: 30, carbs: 8, fat: 3 });
  });
  it('does not submit without a description', () => {
    const onSubmit = vi.fn();
    render(<AddFoodSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LogWeightSheet', () => {
  it('submits parsed weight', () => {
    const onSubmit = vi.fn();
    render(<LogWeightSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('78.4'), { target: { value: '78.4' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith(78.4);
  });
  it('rejects invalid input', () => {
    const onSubmit = vi.fn();
    render(<LogWeightSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('78.4'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
