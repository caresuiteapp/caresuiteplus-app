export const desktopAreaSwitcherCss = `
.cs-desktop-area-switcher {
  display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0;
  box-sizing: border-box; padding: 14px; border: 1px solid #d6e4f3; border-radius: 18px;
  background: linear-gradient(120deg,#fff,#f4f9ff); color: #15304e;
  font: 500 calc(14px * var(--cs-desktop-area-scale,1))/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.cs-desktop-area-switcher *, .cs-desktop-area-switcher *::after { box-sizing: border-box; }
.cs-desktop-area-switcher .cs-desktop-area-heading {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 14px;
}
.cs-desktop-area-switcher .cs-desktop-area-heading h2 { margin: 0; font-size: 1em; font-weight: 700; color: #284a70; }
.cs-desktop-area-switcher .cs-desktop-area-current {
  display: inline-flex; align-items: center; flex-wrap: wrap; gap: 5px;
  color: #426181; font-size: .86em; line-height: 1.4;
}
.cs-desktop-area-switcher .cs-desktop-area-current > span { width: 6px; height: 6px; border-radius: 50%; background: #1764d4; }
.cs-desktop-area-switcher .cs-desktop-area-current strong { color: #1758ab; font-weight: 750; }
.cs-desktop-area-switcher .cs-desktop-area-options {
  display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,calc(112px * var(--cs-desktop-area-scale,1))),1fr)); gap: 8px;
}
.cs-desktop-area-switcher .cs-desktop-area-option {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 4px; min-width: 0; min-height: 44px; margin: 0; padding: 10px 6px 8px;
  border: 1px solid #d9e4f0; border-radius: 13px; background: #fff; color: #385777;
  font: inherit; text-align: center; cursor: pointer; touch-action: manipulation;
  box-shadow: 0 2px 5px #254d7c04; transition: background 160ms ease,border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease;
}
.cs-desktop-area-switcher .cs-desktop-area-artwork { filter: drop-shadow(0 3px 3px #2460a313); }
.cs-desktop-area-switcher .cs-desktop-area-name { max-width: 100%; font-size: .9em; font-weight: 650; overflow-wrap: anywhere; }
.cs-desktop-area-switcher .cs-desktop-area-status { min-height: 1.2em; font-size: .7em; line-height: 1.2; color: #617790; overflow-wrap: anywhere; }
.cs-desktop-area-switcher .cs-desktop-area-option[aria-pressed="true"] {
  border-color: #508fe0; background: linear-gradient(145deg,#eaf4ff,#dcecff); color: #104e9e;
  box-shadow: inset 0 0 0 1px #75a7e42b,0 4px 12px #1764d411;
}
.cs-desktop-area-switcher .cs-desktop-area-option[aria-pressed="true"] .cs-desktop-area-status { color: #1758ab; font-weight: 700; }
.cs-desktop-area-switcher .cs-desktop-area-check {
  position: absolute; top: 5px; right: 6px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: #1764d4; color: #fff; font-size: 11px; font-weight: 750;
}
.cs-desktop-area-switcher .cs-desktop-area-option:disabled { opacity: 1; color: #65768a; background: #f1f4f8; border-color: #e0e7ef; box-shadow: none; cursor: not-allowed; }
.cs-desktop-area-switcher .cs-desktop-area-option:disabled .cs-desktop-area-artwork { filter: grayscale(.65); opacity: .55; }
.cs-desktop-area-switcher .cs-desktop-area-option:focus-visible { outline: 3px solid #1764d4; outline-offset: 3px; }
@media (hover:hover) and (pointer:fine) {
  .cs-desktop-area-switcher .cs-desktop-area-option:not(:disabled):hover { transform: translateY(-1px); border-color: #7da8de; background: #eff6ff; box-shadow: 0 5px 12px #1e5a9b12; }
  .cs-desktop-area-switcher .cs-desktop-area-option[aria-pressed="true"]:hover { border-color: #1764d4; background: #dcecff; }
}
@media (max-width:480px) {
  .cs-desktop-area-switcher { padding: 11px; gap: 10px; }
}
@media (prefers-reduced-motion:reduce) {
  .cs-desktop-area-switcher .cs-desktop-area-option { transition: none; }
  .cs-desktop-area-switcher .cs-desktop-area-option:not(:disabled):hover { transform: none; }
}
`;
