// Generated native presentation from src/screens/settings/userProfileWorkspaceCss.web.ts. Update through scripts/port-native-workspaces.mjs.
export const USER_PROFILE_CONTROLLER_CSS = `
  .cs-profile-controller-state { width: calc(100% - 32px); max-width: 680px; box-sizing: border-box; padding: 28px; margin: 28px auto; border: 1px solid #dce6f2; border-radius: 24px; background: #fff; box-shadow: 0 5px 20px rgba(21, 51, 88, .05); color: #17334f; font-size: calc(15px * var(--app-font-scale, 1)); }
  .cs-profile-controller-state p { margin: 0; line-height: 1.5; }
  .cs-profile-controller-state button { display: inline-flex; justify-content: center; align-items: center; min-height: 44px; margin-top: 18px; padding: 10px 16px; border: 1px solid #c6d9f0; border-radius: 12px; background: #f3f8ff; color: #155fae; font: inherit; font-weight: 650; cursor: pointer; }
  .cs-profile-controller-state button:focus-visible { outline: 3px solid #1477d6; outline-offset: 3px; }
  .cs-profile-controller-state button:disabled { opacity: .55; cursor: not-allowed; }
  .cs-profile-controller-error { width: calc(100% - 32px); max-width: 1124px; box-sizing: border-box; margin: 20px auto 0; padding: 14px 18px; color: #9b3034; background: #fff2f1; border: 1px solid #f1c8c6; border-radius: 14px; font-size: calc(14px * var(--app-font-scale, 1)); overflow-wrap: anywhere; }
`;
export const USER_PROFILE_WORKSPACE_CSS = `
  .cs-profile-workspace {
    --cs-profile-ink: #17334f; --cs-profile-muted: #526983; --cs-profile-blue: #0668da;
    --cs-profile-line: #dce6f2; --cs-profile-radius: 24px;
    width: 100%; max-width: 1184px; margin: 0 auto; padding: clamp(16px, 2.1vw, 30px);
    box-sizing: border-box; color: var(--cs-profile-ink); color-scheme: light;
    font-family: inherit; font-size: calc(15px * var(--app-font-scale, 1)); line-height: 1.5;
  }
  .cs-profile-workspace *, .cs-profile-workspace *::before, .cs-profile-workspace *::after { box-sizing: border-box; }
  .cs-profile-workspace :is(h2, h3, h4, p, dl, dd) { margin: 0; }
  .cs-profile-workspace :is(button, input) { font: inherit; }
  .cs-profile-workspace svg { display: block; flex-shrink: 0; }
  .cs-profile-hero {
    position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(190px, 270px);
    align-items: center; gap: 24px; padding: 28px; margin-bottom: 22px; overflow: hidden;
    border: 1px solid #c8ddf6; border-radius: 28px;
    background: radial-gradient(ellipse at 12% 0, #e3f3ff 0, transparent 60%), linear-gradient(120deg, #fff 12%, #f4f8ff 68%, #edf2ff);
    box-shadow: 0 9px 28px rgba(20, 69, 123, .07), inset 0 1px 0 #fff;
  }
  .cs-profile-hero::after {
    position: absolute; content: ''; right: -65px; top: -100px; width: 260px; height: 260px;
    border-radius: 50%; border: 32px solid rgba(117, 169, 243, .07); pointer-events: none;
  }
  .cs-profile-hero > * { position: relative; z-index: 1; min-width: 0; }
  .cs-profile-avatar {
    width: 108px; height: 108px; flex-shrink: 0; display: grid; place-items: center;
    border: 5px solid #fff; border-radius: 31px; color: #1658ad;
    background: linear-gradient(145deg, #d8eaff, #f7fbff 48%, #e0eaff);
    box-shadow: 0 8px 23px rgba(42, 103, 174, .17), 0 0 0 1px #d0e1f6;
  }
  .cs-profile-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 26px; display: block; }
  .cs-profile-initials { font-size: calc(34px * var(--app-font-scale, 1)); font-weight: 750; letter-spacing: -.04em; }
  .cs-profile-avatar-badge { position: absolute; bottom: -12px; padding: 3px 10px; background: #e9f2ff; color: #0753a4; border: 1px solid #c3d8f3; border-radius: 999px; font-size: calc(11px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-profile-eyebrow { color: #386797; font-size: calc(11px * var(--app-font-scale, 1)); font-weight: 750; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 6px !important; }
  .cs-profile-intro h2 { font-size: clamp(23px, 2.1vw, 29px); font-size: calc(clamp(23px, 2.1vw, 29px) * var(--app-font-scale, 1)); line-height: 1.2; letter-spacing: -.03em; font-weight: 750; overflow-wrap: anywhere; }
  .cs-profile-role { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; color: #165791; background: #e8f2ff; border: 1px solid #ccdef5; border-radius: 999px; padding: 3px 10px; font-size: calc(12px * var(--app-font-scale, 1)); font-weight: 600; max-width: 100%; overflow-wrap: anywhere; }
  .cs-profile-role svg {--cs-action-icon-size:16px; width: 16px; height: 16px; }
  .cs-profile-description { margin-top: 9px !important; color: var(--cs-profile-muted); font-size: calc(13px * var(--app-font-scale, 1)); }
  .cs-profile-photo-actions { display: flex; align-items: flex-start; flex-direction: column; gap: 7px; }
  .cs-profile-file-input { position: absolute; width: 1px !important; height: 1px !important; min-height: 0 !important; padding: 0 !important; margin: -1px; overflow: hidden; clip-path: inset(50%); border: 0 !important; white-space: nowrap; }
  .cs-profile-photo-pending { display: flex; align-items: flex-start; flex-direction: column; gap: 8px; padding-top: 5px; }
  .cs-profile-columns { display: grid; grid-template-columns: minmax(0, 1.24fr) minmax(0, 1fr); gap: 22px; align-items: start; }
  .cs-profile-column { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
  .cs-profile-card { padding: 24px; background: #fff; border: 1px solid var(--cs-profile-line); border-radius: var(--cs-profile-radius); box-shadow: 0 5px 20px rgba(21, 51, 88, .045); min-width: 0; }
  .cs-profile-card-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 23px; }
  .cs-profile-card-heading > div { min-width: 0; }
  .cs-profile-card h3 { font-size: calc(17px * var(--app-font-scale, 1)); line-height: 1.35; letter-spacing: -.02em; font-weight: 700; }
  .cs-profile-card-heading p { margin-top: 3px; font-size: calc(12px * var(--app-font-scale, 1)); color: var(--cs-profile-muted); }
  .cs-profile-icon-tile { width: 42px; height: 42px; display: grid; place-items: center; flex-shrink: 0; color: #1f6bc1; border: 1px solid #dae9fc; border-radius: 14px; background: linear-gradient(145deg, #e7f1ff, #f9fcff); box-shadow: inset 0 1px 0 #fff, 0 3px 7px rgba(27, 90, 159, .05); }
  .cs-profile-icon-tile--violet { color: #6552b7; border-color: #e5e0f8; background: linear-gradient(145deg, #f0ebff, #faf8ff); }
  .cs-profile-icon-tile--teal { color: #147580; border-color: #d4eaed; background: linear-gradient(145deg, #e3f5f6, #f8fefe); }
  .cs-profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 19px 16px; }
  .cs-profile-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .cs-profile-field--full { grid-column: 1 / -1; }
  .cs-profile-field label { font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; color: #294664; }
  .cs-profile-field-label { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .cs-profile-field-label > span { font-size: calc(11px * var(--app-font-scale, 1)); color: #61728a; }
  .cs-profile-field input { display: block; width: 100%; min-width: 0; min-height: 47px; border: 1px solid #bacde2; border-radius: 12px; padding: 10px 13px; color: #17334f; background: #fff; outline: none; transition: border-color .16s ease, box-shadow .16s ease; }
  .cs-profile-field input:focus { box-shadow: 0 0 0 3px rgba(6, 104, 218, .1); }
  .cs-profile-field input[aria-invalid="true"] { border-color: #c65f5b !important; }
  .cs-profile-field input:disabled { color: #56687f; background: #f4f7fb !important; }
  .cs-profile-field-error { color: #9d3539; font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-profile-form-footer { border-top: 1px solid #e7edf5; margin-top: 24px; padding-top: 18px; display: flex; flex-direction: column; gap: 13px; }
  .cs-profile-form-actions { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 8px; }
  .cs-profile-help { color: #58708a; font-size: calc(11px * var(--app-font-scale, 1)); line-height: 1.5; }
  .cs-profile-dirty { display: inline-flex; align-items: center; gap: 7px; color: #8a5b13; font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-profile-dirty > span { width: 6px; height: 6px; background: #b5791e; border-radius: 50%; flex-shrink: 0; }
  .cs-profile-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 15px; border: 1px solid transparent; border-radius: 12px; cursor: pointer; font-size: calc(12px * var(--app-font-scale, 1)) !important; font-weight: 650 !important; line-height: 1.4; text-align: center; max-width: 100%; overflow-wrap: anywhere; transition: background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease; }
  .cs-profile-button svg {--cs-action-icon-size:16px; width: 16px; height: 16px; }
  .cs-profile-button--primary { color: #fff; background: linear-gradient(125deg, #0876ee, #065bc7); border-color: #0866d5; box-shadow: 0 4px 10px rgba(8, 95, 196, .17), inset 0 1px 0 rgba(255, 255, 255, .17); }
  .cs-profile-button--secondary { color: #155fae; background: #f3f8ff; border-color: #c6d9f0; }
  .cs-profile-button--quiet { color: #49617a; background: transparent; border-color: #dce5ef; }
  .cs-profile-button--wide { width: 100%; }
  .cs-profile-workspace button:disabled { cursor: not-allowed; opacity: .55; box-shadow: none; }
  .cs-profile-workspace :is(button, input):focus-visible { outline: 3px solid #1477d6; outline-offset: 3px; }
  .cs-profile-text-button { border: 0; padding: 4px 0; color: #4e6986; background: transparent; font-size: calc(11px * var(--app-font-scale, 1)) !important; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; text-align: left; }
  .cs-profile-feedback { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; border: 1px solid; border-radius: 12px; padding: 10px 12px; font-size: calc(12px * var(--app-font-scale, 1)); overflow-wrap: anywhere; }
  .cs-profile-feedback svg {--cs-action-icon-size:16px; width: 16px; height: 16px; margin-top: 1px; }
  .cs-profile-feedback--error { background: #fff2f1; color: #9b3034; border-color: #f1c8c6; }
  .cs-profile-feedback--success { background: #edf9f3; color: #266647; border-color: #cbe9d9; }
  .cs-profile-photo-actions .cs-profile-feedback { margin-top: 2px; }
  .cs-profile-account-info { padding: 14px 16px; background: #f5f8fc; border: 1px solid #e3ebf5; border-radius: 14px; }
  .cs-profile-account-info dt { display: flex; align-items: center; gap: 7px; color: #55708c; font-size: calc(11px * var(--app-font-scale, 1)); }
  .cs-profile-account-info dt svg {--cs-action-icon-size:16px; width: 16px; height: 16px; }
  .cs-profile-account-info dd { margin-top: 5px; font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; overflow-wrap: anywhere; }
  .cs-profile-password { margin-top: 20px; }
  .cs-profile-password h4 { font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-profile-password p { color: var(--cs-profile-muted); font-size: calc(12px * var(--app-font-scale, 1)); margin: 6px 0 14px; }
  .cs-profile-password .cs-profile-help { margin: 9px 0 0; }
  .cs-profile-link-list { display: flex; flex-direction: column; }
  .cs-profile-link-row { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border: 0; background: transparent; color: var(--cs-profile-ink); cursor: pointer; text-align: left; border-radius: 8px; transition: background .16s ease, color .16s ease; }
  .cs-profile-link-row > span { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
  .cs-profile-link-row strong { font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-profile-link-row > span > span { color: var(--cs-profile-muted); font-size: calc(11px * var(--app-font-scale, 1)); }
  .cs-profile-link-row > svg {--cs-action-icon-size:16px; width: 16px; height: 16px; color: #48749f; transition: transform .16s ease; }
  .cs-profile-link-row + .cs-profile-link-row { border-top: 1px solid #e9eef5; border-radius: 0; }
  .cs-profile-link-row--danger strong { color: #a24648; }
  .cs-profile-card--appearance .cs-profile-card-heading { margin-bottom: 8px; }
  .cs-profile-card--appearance .cs-profile-link-row { padding-bottom: 2px; }
  .cs-profile-session { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 22px; padding: 17px 22px; border: 1px solid #dce5ef; border-radius: 18px; background: rgba(255, 255, 255, .65); }
  .cs-profile-session > div { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .cs-profile-session-icon { color: #58708a; }
  .cs-profile-session p { display: flex; flex-direction: column; gap: 2px; }
  .cs-profile-session strong { font-size: calc(12px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-profile-session p > span { color: var(--cs-profile-muted); font-size: calc(11px * var(--app-font-scale, 1)); }
  @media (hover: hover) {
    .cs-profile-button--primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(8, 95, 196, .24); }
    .cs-profile-button--secondary:not(:disabled):hover { background: #e7f1ff; border-color: #9bbde4; }
    .cs-profile-button--quiet:not(:disabled):hover { background: #f0f5fa; }
    .cs-profile-text-button:not(:disabled):hover { color: #075cb9; }
    .cs-profile-link-row:not(:disabled):hover { color: #075cb9; }
    .cs-profile-link-row:not(:disabled):hover > svg { transform: translateX(3px); }
  }
  @media (max-width: 1020px) {
    .cs-profile-hero { grid-template-columns: auto minmax(0, 1fr); }
    .cs-profile-photo-actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 9px 15px; border-top: 1px solid #dce8f6; padding-top: 18px; }
    .cs-profile-photo-pending { flex-direction: row; flex-wrap: wrap; align-items: center; padding-top: 0; gap: 12px; }
    .cs-profile-photo-actions .cs-profile-feedback { flex-basis: 100%; }
    .cs-profile-columns { gap: 18px; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); }
    .cs-profile-column { gap: 18px; }
    .cs-profile-card { padding: 20px; }
    .cs-profile-fields { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 760px) {
    .cs-profile-columns { grid-template-columns: minmax(0, 1fr); }
    .cs-profile-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cs-profile-hero { padding: 22px; gap: 20px; }
    .cs-profile-avatar { width: 88px; height: 88px; border-radius: 26px; }
    .cs-profile-avatar img { border-radius: 21px; }
    .cs-profile-card { border-radius: 20px; }
  }
  @media (max-width: 480px) {
    .cs-profile-workspace { padding: 12px; }
    .cs-profile-hero { padding: 18px; gap: 16px; border-radius: 22px; }
    .cs-profile-avatar { width: 68px; height: 68px; border-radius: 23px; border-width: 4px; }
    .cs-profile-avatar img { border-radius: 19px; }
    .cs-profile-initials { font-size: calc(24px * var(--app-font-scale, 1)); }
    .cs-profile-intro h2 { font-size: calc(22px * var(--app-font-scale, 1)); }
    .cs-profile-eyebrow { font-size: calc(9px * var(--app-font-scale, 1)); }
    .cs-profile-description { grid-column: 1 / -1; }
    .cs-profile-fields { grid-template-columns: minmax(0, 1fr); }
    .cs-profile-card { padding: 18px; }
    .cs-profile-card-heading { gap: 10px; }
    .cs-profile-form-actions { flex-direction: column-reverse; align-items: stretch; }
    .cs-profile-form-actions .cs-profile-button { width: 100%; }
    .cs-profile-session { padding: 16px; align-items: flex-start; flex-direction: column; gap: 14px; }
    .cs-profile-session > button { align-self: stretch; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-profile-workspace *, .cs-profile-workspace *::before, .cs-profile-workspace *::after { animation: none !important; transition: none !important; transform: none !important; }
  }
`;
