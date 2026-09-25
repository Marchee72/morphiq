import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and lets a later Tailwind class override an earlier one — what shadcn components expect as `cn`. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
