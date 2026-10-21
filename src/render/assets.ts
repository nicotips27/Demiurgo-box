/**
 * Deterministic per-tile hashing.
 *
 * Used to pick a terrain or prop variant for a tile. It must stay stable
 * across frames, otherwise the ground would flicker.
 */
export function getPseudoRandom(x: number, y: number, max: number): number {
  return ((x * 7 + y * 13 + x * y * 3) % max + max) % max;
}
