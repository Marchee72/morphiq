type BackHandler = () => void;

interface BackHandlerEntry {
  id: string;
  handler: BackHandler;
}

const backHandlers: BackHandlerEntry[] = [];

export const registerBackHandler = (id: string, handler: BackHandler): (() => void) => {
  // Remove existing entry with same id if any, then push to top
  const index = backHandlers.findIndex(h => h.id === id);
  if (index !== -1) {
    backHandlers.splice(index, 1);
  }
  backHandlers.push({ id, handler });

  return () => {
    const idx = backHandlers.findIndex(h => h.id === id);
    if (idx !== -1) {
      backHandlers.splice(idx, 1);
    }
  };
};

export const handleGlobalBack = (): boolean => {
  if (backHandlers.length > 0) {
    const top = backHandlers.pop();
    if (top) {
      top.handler();
      return true; // Handled an open modal/sheet
    }
  }
  return false; // No open modal was handled
};
