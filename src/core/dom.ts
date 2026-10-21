/**
 * DOM handles and the viewport.
 *
 * Kept in their own module so that the canvas context and the HUD elements
 * can be imported without dragging in the whole game state. The game boots
 * from a `<script type="module">` at the end of <body>, so the document is
 * already parsed when this module is evaluated.
 */
export const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
export const tooltip = document.getElementById('tooltip') as HTMLDivElement;
export const vPanel = document.getElementById('village-panel') as HTMLDivElement;
export const minimapCanvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
export const mCtx = minimapCanvas.getContext('2d') as CanvasRenderingContext2D;

/**
 * The viewport, in CSS pixels.
 *
 * The canvas backing store is `view.w * view.dpr` pixels wide, and the
 * context carries a permanent device-pixel-ratio transform, so every
 * drawing call can keep working in CSS pixels while the pixels that actually
 * reach the screen stay sharp on high-DPI displays.
 */
export const view = {
  w: window.innerWidth,
  h: window.innerHeight,
  dpr: 1,
};

/** Highest DPR we will render at. Above this the cost is not worth it. */
const MAX_DPR = 2;

/**
 * Resize the canvas backing store to match the viewport and reset the
 * context transform. Call this on load and on every window resize.
 */
export function resizeCanvas(): void {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';

  // Pixel art must never be resampled with interpolation.
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

resizeCanvas();
