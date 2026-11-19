/** preset diorama sizes (metres) */
export const DIORAMA_SIZES = [
  { id: 'small', label: 'Small', w: 24, d: 16 },
  { id: 'medium', label: 'Medium', w: 40, d: 28 },
  { id: 'large', label: 'Large', w: 64, d: 44 },
  { id: 'huge', label: 'Huge', w: 96, d: 64 },
];
export const MIN_SIZE = 12, MAX_WIDTH = 128, MAX_DEPTH = 96;

/** grid spacing for a terrain of this size: 25 cm for most boxes, coarser for huge ones so they stay smooth */
export function cellFor(width: number, depth: number) {
  return Math.max(0.25, Math.ceil(Math.sqrt((width * depth) / 110000) * 20) / 20);
}
