let openModalCount = 0;

export function lockBodyScroll(): void {
  openModalCount++;
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBodyScroll(): void {
  openModalCount = Math.max(0, openModalCount - 1);
  if (typeof document !== 'undefined' && openModalCount === 0) {
    document.body.style.overflow = '';
  }
}
