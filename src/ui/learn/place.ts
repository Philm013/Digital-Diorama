/**
 * Where the lesson card goes: next to the control it points at (below, above, or beside it on
 * wide screens, with an arrow), never on top of it; for big targets such as the 3D view, at the
 * top or bottom of the screen, whichever covers less of the target.
 */
export interface Box { left: number; top: number; right: number; bottom: number; width: number; height: number }
export type Side = 'top' | 'bottom' | 'left' | 'right';
/** the card's top-left corner, and which of its edges carries the arrow (and where along it) */
export interface Placement { x: number; y: number; side: Side | null; arrow: number }

const M = 8;
const GAP = 14;

function overlap(a: Box, x: number, y: number, w: number, h: number) {
  const ix = Math.max(0, Math.min(a.right, x + w) - Math.max(a.left, x));
  const iy = Math.max(0, Math.min(a.bottom, y + h) - Math.max(a.top, y));
  return ix * iy;
}

/**
 * @param t       the target's rectangle (null: none)
 * @param area    `t` is an area to work in (the 3D view) rather than a control: no arrow, keep clear of it if possible
 * @param top     the lowest the card may start (under the top bar)
 */
export function placeCard(t: Box | null, w: number, h: number, vw: number, vh: number, top: number, wide: boolean, area = false): Placement {
  const cx = (x: number) => Math.max(M, Math.min(vw - w - M, x));
  const cy = (y: number) => Math.max(top + M, Math.min(vh - h - M, y));
  const centreX = wide ? (vw - w) / 2 : cx((vw - w) / 2);
  const atTop: Placement = { x: centreX, y: top + M, side: null, arrow: 0 };
  const atBottom: Placement = { x: centreX, y: vh - h - M, side: null, arrow: 0 };
  if (!t) return atTop;
  if (area) {
    // over the 3D view: at the top, unless the bottom of the screen is clear of it (a panel is there)
    return overlap(t, atBottom.x, atBottom.y, w, h) === 0 ? atBottom : atTop;
  }
  const mx = t.left + t.width / 2, my = t.top + t.height / 2;
  const below = (): Placement | null => (t.bottom + GAP + h <= vh - M ? { x: cx(mx - w / 2), y: t.bottom + GAP, side: 'top', arrow: 0 } : null);
  const above = (): Placement | null => (t.top - GAP - h >= top + M ? { x: cx(mx - w / 2), y: t.top - GAP - h, side: 'bottom', arrow: 0 } : null);
  const right = (): Placement | null => (wide && t.right + GAP + w <= vw - M ? { x: t.right + GAP, y: cy(my - h / 2), side: 'left', arrow: 0 } : null);
  const left = (): Placement | null => (wide && t.left - GAP - w >= M ? { x: t.left - GAP - w, y: cy(my - h / 2), side: 'right', arrow: 0 } : null);
  const tall = t.height > vh * 0.45;
  // phones: a big control low on the screen (the panel's contents) keeps its panel's header in
  // view — the card goes to the top of the screen instead of right above it
  if (!wide && t.height > 110 && t.top > vh * 0.3 && overlap(t, atTop.x, atTop.y, w, h) === 0) return atTop;
  const sides = t.left > vw - t.right ? [left, right] : [right, left];
  const order = tall ? [...sides, below, above] : my > vh / 2 ? [above, below, ...sides] : [below, above, ...sides];
  for (const f of order) {
    const p = f();
    if (!p) continue;
    // the arrow points at the middle of the target, kept away from the card's rounded corners
    p.arrow = p.side === 'top' || p.side === 'bottom' ? Math.max(22, Math.min(w - 22, mx - p.x)) : Math.max(22, Math.min(h - 22, my - p.y));
    return p;
  }
  // nowhere beside it: the top or bottom of the screen, whichever hides less of it
  return overlap(t, atBottom.x, atBottom.y, w, h) < overlap(t, atTop.x, atTop.y, w, h) ? atBottom : atTop;
}
