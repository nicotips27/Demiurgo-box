/**
 * Ambient declarations for the browser globals the legacy code reaches for.
 *
 * These are properties the game attaches at runtime (or that older browsers
 * expose under a vendor prefix), so TypeScript does not know about them.
 */

interface Window {
  /** Vendor-prefixed AudioContext, used as a fallback on older Safari. */
  webkitAudioContext?: typeof AudioContext;
  /** Toolbar helpers installed by src/ui/input.ts. */
  toggleToolbarCollapse: () => void;
  resetToolbarPosition: () => void;
  closeSidePanel: (id: string) => void;
}

interface Screen {
  /** Vendor-prefixed orientation lock, used as a fallback on older browsers. */
  mozOrientation?: any;
  msOrientation?: any;
}

interface HTMLElement {
  /** Timer handle cached on HUD elements (timeout id). */
  _ac?: any;
  /** Timer handle used to hide the "now playing" label again. */
  _hideTimer?: any;
}
