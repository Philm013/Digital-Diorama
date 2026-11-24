/**
 * Moments the learning path listens for that leave no trace in the diorama itself: the camera
 * flew back to the overview, an undo, an organism picked in the food web, a guided tour reaching
 * its end, coming home from roaming… UI code calls `learnSignal(name)`; the lesson coach listens.
 */
type Listener = (name: string) => void;
const listeners = new Set<Listener>();

export function learnSignal(name: string) { for (const fn of listeners) fn(name); }
export function onLearnSignal(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
