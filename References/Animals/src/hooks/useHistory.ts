import { useCallback, useState } from 'react';
import type { AnimalOptions } from '../data/catalog';

export function useHistory(initial: AnimalOptions) {
  const [state, setState] = useState({ entries: [initial], index: 0 });
  const value = state.entries[state.index];
  const push = useCallback((next: AnimalOptions) => {
    setState(previous => {
      if (JSON.stringify(previous.entries[previous.index]) === JSON.stringify(next)) return previous;
      const entries = [...previous.entries.slice(0, previous.index + 1), next].slice(-70);
      return { entries, index: entries.length - 1 };
    });
  }, []);
  const reset = useCallback((next: AnimalOptions = {}) => setState({ entries: [next], index: 0 }), []);
  const undo = useCallback(() => setState(previous => ({ ...previous, index: Math.max(0, previous.index - 1) })), []);
  const redo = useCallback(() => setState(previous => ({ ...previous, index: Math.min(previous.entries.length - 1, previous.index + 1) })), []);
  return { value, push, reset, undo, redo, canUndo: state.index > 0, canRedo: state.index < state.entries.length - 1 };
}