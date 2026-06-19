/**
 * Web-only CSS: suppress mouse-hover visual changes app-wide.
 * Touch press (:active) and React Native onPressIn feedback are unchanged.
 */
export const DISABLE_HOVER_EFFECTS_CSS = `
@media (hover: hover) and (pointer: fine) {
  *:hover {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
}
`;
