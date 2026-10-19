export const desktopAppsWidgetsCenterCss = `
.cs-center-area-switcher { width: min(300px,calc(225px * var(--cs-center-scale,1))); min-width: 0; max-width: 100%; flex-shrink: 1; }
.cs-apps-center, .cs-apps-center-footer {
  color: #15304e; font: 400 calc(14px * var(--cs-center-scale, 1))/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-width: 0; width: 100%; box-sizing: border-box;
}
.cs-apps-center *, .cs-apps-center-footer * { box-sizing: border-box; }
.cs-apps-center { display: flex; flex-direction: column; gap: 20px; }
.cs-apps-center :is(h2,h3,p), .cs-apps-center-footer p { margin: 0; }
.cs-apps-center button, .cs-apps-center input, .cs-apps-center-footer button { font: inherit; }
.cs-apps-center button, .cs-apps-center-footer button { cursor: pointer; touch-action: manipulation; }
.cs-apps-center button:disabled { cursor: default; opacity: .45; }
.cs-apps-center :is(button,input):focus-visible, .cs-apps-center-footer button:focus-visible,
.cs-apps-center [role="tabpanel"]:focus-visible { outline: 3px solid #1764d4; outline-offset: 3px; }
.cs-apps-center .cs-center-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
.cs-apps-center .cs-center-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 16px; background: #e8eff8; border: 1px solid #dce5f1; }
.cs-apps-center .cs-center-tab { display: inline-flex; gap: 7px; align-items: center; justify-content: center; min-height: 42px; padding: 9px 13px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: #45607a; font-weight: 650; }
.cs-apps-center .cs-center-tab[aria-selected="true"] { background: #fff; color: #164f9c; border-color: #d1e0f2; box-shadow: 0 3px 8px #173f7210; }
.cs-apps-center .cs-center-tab-count { min-width: 23px; padding: 1px 5px; font-size: .82em; font-weight: 700; border-radius: 7px; background: #dce7f6; color: #264d7b; }
.cs-apps-center .cs-center-search { display: flex; align-items: center; flex: 1 1 250px; max-width: 380px; min-width: 0; border: 1px solid #c5d6e9; background: #fff; border-radius: 13px; padding: 0 12px; gap: 9px; box-shadow: 0 2px 5px #24456b04; }
.cs-apps-center .cs-center-search > span { color: #506d8d; font-size: 22px; }
.cs-apps-center .cs-center-search input { appearance: none; width: 100%; min-width: 0; min-height: 44px; padding: 9px 0; border: 0; border-radius: 0; background: transparent; color: #15304e; -webkit-text-fill-color: #15304e; caret-color: #1764d4; }
.cs-apps-center .cs-center-search input::placeholder { color: #61768e; -webkit-text-fill-color: #61768e; opacity: 1; }
.cs-apps-center .cs-center-search:focus-within { border-color: #1764d4; box-shadow: 0 0 0 3px #1764d417; }
.cs-apps-center .cs-center-search input:focus-visible { outline-offset: 1px; }
.cs-apps-center .cs-center-filters { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.cs-apps-center .cs-center-chips, .cs-apps-center .cs-center-selected-filter { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.cs-apps-center .cs-center-chip, .cs-apps-center .cs-center-selected-filter button { min-height: 38px; padding: 7px 12px; border: 1px solid #d1deed; background: #fff; color: #405c78; border-radius: 11px; font-size: .93em; }
.cs-apps-center .cs-center-chip[aria-pressed="true"], .cs-apps-center .cs-center-selected-filter button[aria-pressed="true"] { color: #104e9f; border-color: #8eb5e7; background: #e8f1ff; font-weight: 650; }
.cs-apps-center .cs-center-chip-count { margin-left: 6px; color: #61768e; }
.cs-apps-center .cs-center-panel { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.cs-apps-center .cs-center-section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cs-apps-center .cs-center-section-heading h2 { font-size: 1.23em; font-weight: 750; color: #15304e; line-height: 1.35; }
.cs-apps-center .cs-center-section-heading p { color: #506780; max-width: 760px; margin-top: 4px; }
.cs-apps-center .cs-center-result-count { flex-shrink: 0; color: #526a83; font-size: .9em; padding-top: 3px; }
.cs-apps-center .cs-center-desktop-summary { padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 9px; border: 1px solid #d3e2f4; border-radius: 13px; background: linear-gradient(115deg,#edf5ff,#fafdff); color: #385977; }
.cs-apps-center .cs-center-desktop-summary strong { color: #184f91; }
.cs-apps-center .cs-center-desktop-summary span { font-size: .93em; }
.cs-apps-center .cs-center-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,calc(260px * var(--cs-center-scale,1))),1fr)); gap: 14px; }
.cs-apps-center .cs-center-card { position: relative; display: flex; flex-direction: column; min-width: 0; border: 1px solid #d7e3f1; border-radius: 19px; background: #fff; box-shadow: 0 4px 16px #1a426b06; overflow: hidden; transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
.cs-apps-center .cs-center-app-card, .cs-apps-center .cs-center-workflow-card { width: 100%; padding: 0; text-align: left; color: #15304e; }
.cs-apps-center .cs-center-card-heading { min-width: 0; padding: 16px 16px 12px; }
.cs-apps-center .cs-center-glyph { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; flex-shrink: 0; border: 1px solid #d4e4f8; border-radius: 13px; background: linear-gradient(145deg,#eff7ff,#e5efff); color: #1764b8; font-size: 21px; font-weight: 750; }
.cs-apps-center .cs-center-card h3 { font-size: 1.07em; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.cs-apps-center .cs-center-card-kind { display: block; color: #61768e; font-size: .86em; margin-top: 3px; }
.cs-apps-center .cs-center-card-description { color: #4b637c; overflow-wrap: anywhere; }
.cs-apps-center .cs-center-card-link { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: auto; padding-top: 4px; color: #175db4; font-weight: 650; font-size: .95em; }
.cs-apps-center .cs-center-widget-heading { display: flex; flex-direction: column; gap: 7px; }
.cs-apps-center .cs-center-widget-heading h3 { min-height: 1.4em; }
.cs-apps-center .cs-center-artwork-preview { display: flex; align-items: center; justify-content: center; height: 160px; min-height: 160px; margin: 0 12px; padding: 8px; overflow: hidden; border: 1px solid #e1eaf4; border-radius: 13px; background: radial-gradient(ellipse at 50% 80%,#dcecff,#f3f8fe 70%); pointer-events: none; }
.cs-apps-center .cs-center-artwork-preview > .cs-desktop-catalog-artwork { max-width: 240px; filter: drop-shadow(0 8px 8px #2363a51a); transition: transform 180ms ease; }
.cs-apps-center .cs-center-card-body { display: flex; flex: 1; flex-direction: column; gap: 12px; padding: 14px 16px 16px; }
.cs-apps-center .cs-center-card-body > p { flex: 1; }
.cs-apps-center .cs-center-badge { display: inline-flex; align-self: flex-start; align-items: center; gap: 5px; padding: 3px 8px; border: 1px solid #bedecf; border-radius: 7px; background: #eaf7ef; color: #206040; font-size: .79em; font-weight: 650; }
.cs-apps-center .cs-center-badge-muted { border-color: #dce5f1; color: #5b7189; background: #f4f7fb; }
.cs-apps-center .cs-center-button, .cs-apps-center-footer .cs-center-button { min-height: 42px; padding: 9px 13px; border: 1px solid #b4ceec; border-radius: 11px; background: #eaf3ff; color: #1455a4; font-weight: 650; line-height: 1.4; }
.cs-apps-center .cs-center-button-neutral { border-color: #c5d6e9; background: #fff; color: #3b5877; }
.cs-apps-center .cs-center-widget-actions { display: flex; flex-direction: column; gap: 9px; margin-top: auto; }
.cs-apps-center .cs-center-reorder { display: flex; align-items: center; gap: 6px; }
.cs-apps-center .cs-center-reorder > span { margin-right: auto; font-size: .86em; color: #5e7189; }
.cs-apps-center .cs-center-reorder button { width: 38px; height: 38px; border-radius: 9px; border: 1px solid #ccdaea; background: #f6f9fe; color: #264f7d; font-size: 20px; line-height: 1; }
.cs-apps-center .cs-center-card[data-selected="true"] { border-color: #9ebfe9; box-shadow: 0 4px 18px #1764d40a; }
.cs-apps-center .cs-center-background-card { padding: 0; text-align: left; color: #15304e; }
.cs-apps-center .cs-center-background-preview { width: 100%; aspect-ratio: 16/9; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #e5edf7; }
.cs-apps-center .cs-center-background-preview > img { width: 100%; height: 100%; display: block; object-fit: cover; }
.cs-apps-center .cs-center-preview-unavailable { padding: 20px; color: #526d8a; font-size: .93em; }
.cs-apps-center .cs-center-background-footer { padding: 13px 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.cs-apps-center .cs-center-background-check { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #c6d6e9; color: #1764d4; width: 27px; height: 27px; flex-shrink: 0; border-radius: 50%; background: #f5f8fd; }
.cs-apps-center .cs-center-background-card[aria-pressed="true"] .cs-center-background-check { background: #1764d4; color: white; border-color: #1764d4; }
.cs-apps-center .cs-center-empty { display: flex; align-items: center; text-align: center; flex-direction: column; gap: 12px; padding: 32px 20px; border: 1px dashed #bed1e7; border-radius: 18px; background: #ffffffba; }
.cs-apps-center .cs-center-empty h3 { font-size: 1.12em; }
.cs-apps-center .cs-center-empty p { color: #556e87; max-width: 540px; }
.cs-apps-center .cs-center-recovery { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 13px 15px; border: 1px solid #a9cbed; border-radius: 13px; background: #edf6ff; color: #305777; }
.cs-apps-center .cs-center-recovery p { flex: 1 1 260px; }
.cs-apps-center-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.cs-apps-center-footer .cs-center-save-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: #48627c; font-size: .93em; flex: 1 1 230px; }
.cs-apps-center-footer .cs-center-save-status[data-status="saved"] { color: #246143; }
.cs-apps-center-footer .cs-center-save-status[data-status="error"] { color: #a32727; }
.cs-apps-center-footer .cs-center-retry { border: 1px solid #dfb3b3; border-radius: 9px; background: #fff4f4; color: #952929; padding: 7px 10px; min-height: 38px; font-weight: 600; }
.cs-apps-center-footer .cs-center-button { background: #1764d4; color: #fff; border-color: #1764d4; min-width: 90px; }
@media (hover:hover) and (pointer:fine) {
  .cs-apps-center :is(.cs-center-app-card,.cs-center-workflow-card,.cs-center-background-card):hover { transform: translateY(-2px); border-color: #91b6e4; box-shadow: 0 9px 24px #173e7212; }
  .cs-apps-center .cs-center-widget-card:hover { border-color: #a6c3e5; }
  .cs-apps-center :is(.cs-center-app-card,.cs-center-widget-card,.cs-center-workflow-card):hover .cs-center-artwork-preview > .cs-desktop-catalog-artwork { transform: translateY(-3px) scale(1.025); }
  .cs-apps-center :is(.cs-center-chip,.cs-center-tab):hover { color: #1455a4; background: #f8fbff; }
  .cs-apps-center .cs-center-button:hover { background: #daeaff; }
  .cs-apps-center-footer .cs-center-button:hover { background: #1054b8; }
}
@media (max-width:680px) {
  div:has(> div > .cs-center-area-switcher) { flex-wrap: wrap; }
  div:has(> div > .cs-center-area-switcher) > div:first-child { flex-basis: 100% !important; }
  div:has(> .cs-center-area-switcher) { flex: 1 1 100% !important; min-width: 0; }
  .cs-center-area-switcher { width: auto; flex: 1 1 0; }
  .cs-apps-center { gap: 16px; }
  .cs-apps-center .cs-center-toolbar { align-items: stretch; }
  .cs-apps-center .cs-center-tabs { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); width: 100%; }
  .cs-apps-center .cs-center-search { max-width: none; flex-basis: 100%; }
  .cs-apps-center .cs-center-chip { min-height: 42px; }
  .cs-apps-center .cs-center-section-heading { gap: 5px; }
}
@media (prefers-reduced-motion:reduce) {
  .cs-apps-center *, .cs-apps-center-footer * { transition: none !important; animation: none !important; }
  .cs-apps-center .cs-center-card:hover { transform: none; }
  .cs-apps-center .cs-center-card:hover .cs-center-artwork-preview > .cs-desktop-catalog-artwork { transform: none; }
}
`;

