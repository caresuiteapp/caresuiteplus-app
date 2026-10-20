/**
 * Web-only font-scale custom property on :root.
 * Typography tokens use calc(Npx * var(--app-font-scale)) so only text sizes change.
 */
export const WEB_FONT_SCALE_CSS = `
:root {
  --app-font-scale: 1;
}
`;
