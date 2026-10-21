export interface ScreenBounds { readonly left: number; readonly right: number; readonly bottom: number; readonly top: number }
/** A partially visible object is cleared whole; objects entirely offscreen are preserved. */
export function intersectsScreen(x: number, y: number, halfWidth: number, halfHeight: number, bounds: ScreenBounds): boolean {
  return x + halfWidth >= bounds.left && x - halfWidth <= bounds.right
    && y + halfHeight >= bounds.bottom && y - halfHeight <= bounds.top;
}
