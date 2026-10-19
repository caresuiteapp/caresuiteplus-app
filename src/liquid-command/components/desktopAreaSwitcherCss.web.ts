export const desktopAreaSwitcherCss = `
.cs-desktop-area-switcher {
  display: flex; flex-direction: column; gap: 2px; min-width: 0; width: 100%; max-width: 100%;
  box-sizing: border-box; padding: 7px 11px 3px; border: 1px solid #b9ddff55; border-radius: 14px;
  background: linear-gradient(135deg,#113351ed,#09213bea); color: #f0f8ff;
  font: 500 calc(14px * var(--cs-desktop-area-scale,1))/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  cursor: pointer; transition: border-color 160ms ease, box-shadow 160ms ease;
}
.cs-desktop-area-switcher *, .cs-desktop-area-switcher *::after { box-sizing: border-box; }
.cs-desktop-area-switcher[data-appearance="header"] {
  width: calc(230px * var(--cs-desktop-area-scale,1)); max-width: 100%; flex-shrink: 1;
}
.cs-desktop-area-switcher .cs-desktop-area-label-row {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 2px 10px;
  font-size: .72em; font-weight: 650; color: #c3ddf4;
}
.cs-desktop-area-switcher .cs-desktop-area-hint { color: #99d9ff; font-weight: 500; }
.cs-desktop-area-switcher .cs-desktop-area-control { position: relative; display: block; min-width: 0; }
.cs-desktop-area-switcher select {
  appearance: none; -webkit-appearance: none; display: block; width: 100%; max-width: 100%; min-width: 0;
  min-height: 36px; margin: 0; padding: 4px 26px 5px 0; border: 0; border-radius: 5px;
  background: transparent; color: inherit; -webkit-text-fill-color: currentColor; font: inherit; font-weight: 750;
  cursor: pointer; touch-action: manipulation; text-overflow: ellipsis;
}
.cs-desktop-area-switcher select option { background: #fff; color: #15304e; }
.cs-desktop-area-switcher select option:disabled { color: #64748b; }
.cs-desktop-area-switcher .cs-desktop-area-chevron {
  position: absolute; top: 50%; right: 3px; width: 8px; height: 8px; margin-top: -6px;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); pointer-events: none;
}
.cs-desktop-area-switcher:focus-within { border-color: #83d6ff; box-shadow: 0 0 0 3px #83d6ff35; }
.cs-desktop-area-switcher select:focus-visible { outline: 2px solid #83d6ff; outline-offset: 1px; }
.cs-desktop-area-switcher[data-appearance="light"] {
  background: linear-gradient(135deg,#f3f8ff,#e9f3ff); color: #153d6a; border-color: #bfd3ec;
}
.cs-desktop-area-switcher[data-appearance="light"] .cs-desktop-area-label-row { color: #48617e; }
.cs-desktop-area-switcher[data-appearance="light"] .cs-desktop-area-hint { color: #175baa; }
.cs-desktop-area-switcher[data-appearance="light"]:focus-within { border-color: #1764d4; box-shadow: 0 0 0 3px #1764d41c; }
.cs-desktop-area-switcher[data-appearance="light"] select:focus-visible { outline-color: #1764d4; }
@media (hover:hover) and (pointer:fine) {
  .cs-desktop-area-switcher:hover { border-color: #9fdcff; }
  .cs-desktop-area-switcher[data-appearance="light"]:hover { border-color: #729ed8; }
}
@media (prefers-reduced-motion:reduce) {
  .cs-desktop-area-switcher { transition: none; }
}
`;
