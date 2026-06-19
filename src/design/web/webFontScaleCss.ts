/**
 * Web-only global font scaling via CSS custom property on :root.
 * React Native Web text uses px; zoom on the app root scales all content uniformly.
 */
export const WEB_FONT_SCALE_CSS = `
:root {
  --app-font-scale: 1;
}
#root,
#expo-root {
  zoom: var(--app-font-scale);
}
`;
