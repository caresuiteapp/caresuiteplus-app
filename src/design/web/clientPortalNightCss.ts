/** Only primitive surfaces; document/PDF content keeps its own paper colors. */
export const clientPortalNightCss = `
html[data-cs-portal-premium="client"] { color-scheme: dark; background: #102238; }
html[data-cs-portal-premium="client"] .cs-llgan-glass,
html[data-cs-portal-premium="client"] [data-cs-llgan-glass] {
  color: #F5F9FF !important; border-color: rgba(213,235,252,.24) !important;
  background-color: rgba(235,246,255,.095) !important; background-image: none !important;
  box-shadow: none !important;
}
html[data-cs-portal-premium="client"] [data-cs-llgan-glass="modal"] {
  background-color: #20394F !important;
}
html[data-cs-portal-premium="client"] [data-cs-llgan-glass="input"],
html[data-cs-portal-premium="client"] [data-cs-healthos-component="input-control"] {
  color: #F5F9FF !important; background-color: #173247 !important;
  border-color: rgba(213,235,252,.35) !important; color-scheme: dark;
}
html[data-cs-portal-premium="client"] input::placeholder,
html[data-cs-portal-premium="client"] textarea::placeholder { color: #C6DFED; opacity: 1; }
html[data-cs-portal-premium="client"] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] {
  background: #BCEEFF !important; border-color: #BCEEFF !important; color: #102B40 !important;
}
html[data-cs-portal-premium="client"] [data-cs-healthos-component="button"][data-cs-healthos-variant="primary"] * { color: #102B40 !important; }
html[data-cs-portal-premium="client"] [data-cs-healthos-component="button"][data-cs-healthos-variant="secondary"] *,
html[data-cs-portal-premium="client"] [data-cs-healthos-component="button"][data-cs-healthos-variant="ghost"] * { color: #BCEEFF !important; }
html[data-cs-portal-premium="client"] :is(button,a,input,textarea,select,[role="button"],[role="tab"]):focus-visible {
  outline: 3px solid #BCEEFF; outline-offset: 3px;
}
html[data-cs-portal-premium="client"] .academy-workspace {
  --ac-ink: #F5F9FF; --ac-secondary: #D9E9F5; --ac-muted: #C6DFED;
  --ac-blue: #BCEEFF; --ac-on-accent: #102B40; --ac-navy: #1D384F;
  --ac-glass: rgba(235,246,255,.095); --ac-glass-strong: #203E54;
  --ac-line: rgba(213,235,252,.24); --ac-line-strong: rgba(188,238,255,.55);
  --ac-input: #173247; --ac-hover: rgba(188,238,255,.09); --ac-selected: #244A61;
  --ac-danger: #FFE1E9; --ac-attention: #FFE5B8; --ac-good: #B3F0DF;
  --ac-primary-gradient: linear-gradient(#BCEEFF,#BCEEFF);
  background: #17374D; color: #F5F9FF; font-size: calc(16px * var(--app-font-scale, 1));
}
html[data-cs-portal-premium="client"] .academy-workspace .ac-header,
html[data-cs-portal-premium="client"] .academy-workspace .ac-course-cover {
  background: #203E54; color: #F5F9FF; box-shadow: none;
}
html[data-cs-portal-premium="client"] .academy-workspace .ac-header-copy p,
html[data-cs-portal-premium="client"] .academy-workspace .ac-header .ac-eyebrow { color: #D9E9F5; }
html[data-cs-portal-premium="client"] .academy-workspace .ac-header .ac-button:not(.primary):not(.danger) { color: #BCEEFF; border-color: rgba(213,235,252,.24); background: #173247; }
html[data-cs-portal-premium="client"] :is(input,textarea,select) {
  min-width: 0; max-width: 100%; font-size: calc(16px * var(--app-font-scale, 1)) !important; line-height: 1.5;
}
`;
