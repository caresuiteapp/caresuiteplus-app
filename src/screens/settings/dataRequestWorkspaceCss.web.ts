export const DATA_REQUEST_WORKSPACE_CSS = `
  .cs-data-request {
    --dr-ink: #17334f; --dr-muted: #526983; --dr-line: #dce6f2;
    width: 100%; max-width: 1184px; margin: 0 auto; padding: clamp(16px, 2.1vw, 30px);
    box-sizing: border-box; color: var(--dr-ink); color-scheme: light; font-family: inherit;
    font-size: calc(15px * var(--app-font-scale, 1)); line-height: 1.5;
    container-name: data-request; container-type: inline-size;
  }
  .cs-data-request *, .cs-data-request *::before, .cs-data-request *::after { box-sizing: border-box; }
  .cs-data-request :is(h2, h3, h4, p, dl, dd, fieldset) { margin: 0; }
  .cs-data-request :is(button, input, textarea, select) { font: inherit; }
  .cs-data-request svg { display: block; flex-shrink: 0; }
  .cs-data-request-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: start; gap: 22px; }
  .cs-data-request-aside { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .cs-data-request-card {
    min-width: 0; padding: 24px; border: 1px solid var(--dr-line); border-radius: 24px;
    background: #fff; box-shadow: 0 5px 20px rgba(21, 51, 88, .045);
  }
  .cs-data-request-card--export {
    background: radial-gradient(ellipse at 100% 0, rgba(225, 241, 255, .7), transparent 58%), #fff;
  }
  .cs-data-request-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 21px; }
  .cs-data-request-heading > div { min-width: 0; }
  .cs-data-request-heading h2 { font-size: calc(18px * var(--app-font-scale, 1)); font-weight: 700; letter-spacing: -.025em; line-height: 1.35; overflow-wrap: anywhere; }
  .cs-data-request-heading p { margin-top: 4px; color: var(--dr-muted); font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-icon-tile { width: 44px; height: 44px; display: grid; place-items: center; flex-shrink: 0; color: #1f6bc1; border: 1px solid #d7e6fa; border-radius: 14px; background: linear-gradient(145deg, #e6f0ff, #f9fcff); box-shadow: inset 0 1px 0 #fff, 0 3px 7px rgba(27, 90, 159, .05); }
  .cs-data-request-icon-tile--teal { color: #147580; border-color: #d4eaed; background: linear-gradient(145deg, #e3f5f6, #f8fefe); }
  .cs-data-request-icon-tile--violet { color: #6552b7; border-color: #e4def8; background: linear-gradient(145deg, #f0ebff, #faf8ff); }
  .cs-data-request-fieldset { min-width: 0; padding: 0; border: 0; }
  .cs-data-request-legend { padding: 0; margin-bottom: 10px; color: #294664; font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-types { display: flex; flex-direction: column; gap: 9px; }
  .cs-data-request-type {
    display: grid; grid-template-columns: 18px 32px minmax(0, 1fr); align-items: center; gap: 10px;
    position: relative; padding: 13px 14px; border: 1px solid #d4e1ef; border-radius: 14px;
    cursor: pointer; background: #fff; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
  }
  .cs-data-request-type--selected { background: #f0f6ff; border-color: #76a7df; box-shadow: inset 0 0 0 1px rgba(32, 111, 201, .1); }
  .cs-data-request-type--disabled { cursor: not-allowed; opacity: .6; }
  .cs-data-request-type input { appearance: auto; width: 17px !important; height: 17px !important; min-height: 0 !important; margin: 0; padding: 0 !important; accent-color: #0668da; cursor: inherit; }
  .cs-data-request-type-icon { display: grid; place-items: center; width: 32px; height: 32px; color: #4377ad; }
  .cs-data-request-type-copy { min-width: 0; }
  .cs-data-request-type-copy strong { display: block; overflow-wrap: anywhere; color: #234665; font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-type-copy > span { display: block; margin-top: 2px; color: var(--dr-muted); font-size: calc(11px * var(--app-font-scale, 1)); overflow-wrap: anywhere; }
  .cs-data-request-contact-help { margin-top: 9px !important; }
  .cs-data-request-card > .cs-data-request-feedback { margin: 0 0 18px; }
  .cs-data-request-feedback + :is(.cs-data-request-list, .cs-data-request-empty) { margin-top: 16px; }
  .cs-data-request-contact-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(210px * var(--app-font-scale, 1))), 1fr)); gap: 14px; margin-top: 20px; }
  .cs-data-request-contact-fields .cs-data-request-field { margin-top: 0; }
  .cs-data-request-contact-fields input { display: block; width: 100%; min-width: 0; min-height: 45px; border: 1px solid #bacde2; border-radius: 12px; padding: 10px 13px; color: #17334f; background: #fff; outline: none; transition: border-color .16s ease, box-shadow .16s ease; }
  .cs-data-request-contact-fields input:focus { border-color: #3487dd; box-shadow: 0 0 0 3px rgba(6, 104, 218, .1); }
  .cs-data-request-contact-fields input[aria-invalid="true"] { border-color: #c65f5b !important; }
  .cs-data-request-contact-fields input:disabled { color: #56687f; background: #f4f7fb !important; }
  .cs-data-request-account { display: flex; flex-wrap: wrap; gap: 5px 8px; padding: 11px 13px; border: 1px solid #e0e8f1; border-radius: 12px; margin-bottom: 18px !important; background: #f6f9fc; color: #526983; font-size: calc(11px * var(--app-font-scale, 1)); overflow-wrap: anywhere; }
  .cs-data-request-account strong { color: #294664; font-weight: 650; }
  .cs-data-request-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; margin-top: 20px; }
  .cs-data-request-label-line { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .cs-data-request-label-line label { color: #294664; font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-help { color: #58708a; font-size: calc(11px * var(--app-font-scale, 1)); line-height: 1.5; }
  .cs-data-request textarea {
    display: block; width: 100%; min-width: 0; min-height: 116px; resize: vertical;
    border: 1px solid #bacde2; border-radius: 12px; padding: 11px 13px; color: #17334f;
    background: #fff; line-height: 1.5; outline: none; transition: border-color .16s ease, box-shadow .16s ease;
  }
  .cs-data-request textarea:focus { border-color: #3487dd; box-shadow: 0 0 0 3px rgba(6, 104, 218, .1); }
  .cs-data-request textarea:disabled { color: #56687f; background: #f4f7fb !important; }
  .cs-data-request textarea[aria-invalid="true"] { border-color: #c65f5b !important; }
  .cs-data-request-field-error { color: #9d3539; font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-form-footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 13px; border-top: 1px solid #e7edf5; padding-top: 18px; margin-top: 20px; }
  .cs-data-request-form-footer > p { flex: 1 1 180px; max-width: 35em; }
  .cs-data-request-button {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px;
    max-width: 100%; padding: 10px 15px; border: 1px solid transparent; border-radius: 12px; cursor: pointer;
    font-size: calc(12px * var(--app-font-scale, 1)) !important; font-weight: 650 !important;
    line-height: 1.4; text-align: center; overflow-wrap: anywhere;
    transition: background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease;
  }
  .cs-data-request-button svg {--cs-action-icon-size:16px; width: 16px; height: 16px; }
  .cs-data-request-button--primary { color: #fff; background: linear-gradient(125deg, #0876ee, #065bc7); border-color: #0866d5; box-shadow: 0 4px 10px rgba(8, 95, 196, .17), inset 0 1px 0 rgba(255, 255, 255, .17); }
  .cs-data-request-button--secondary { color: #155fae; background: #f3f8ff; border-color: #c6d9f0; }
  .cs-data-request-button--quiet { color: #49617a; background: #fff; border-color: #dce5ef; }
  .cs-data-request-button--wide { width: 100%; }
  .cs-data-request :is(button, input, textarea, select, summary):focus-visible { outline: 3px solid #1477d6; outline-offset: 3px; }
  .cs-data-request button:disabled { cursor: not-allowed; opacity: .55; box-shadow: none; }
  .cs-data-request-feedback { display: flex; align-items: flex-start; gap: 8px; padding: 11px 13px; margin-top: 14px; border: 1px solid; border-radius: 12px; font-size: calc(12px * var(--app-font-scale, 1)); overflow-wrap: anywhere; }
  .cs-data-request-feedback svg {--cs-action-icon-size:16px; width: 16px; height: 16px; margin-top: 1px; }
  .cs-data-request-feedback--error { color: #9b3034; border-color: #f1c8c6; background: #fff2f1; }
  .cs-data-request-feedback--success { color: #266647; border-color: #cbe9d9; background: #edf9f3; }
  .cs-data-request-feedback--notice { color: #80561e; border-color: #ead5b0; background: #fff9ed; }
  .cs-data-request-export-scope { padding: 15px 16px; margin: 16px 0; border: 1px solid #deebf6; border-radius: 14px; background: rgba(246, 250, 255, .9); }
  .cs-data-request-export-scope h3 { font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-export-scope ul { padding: 0; margin: 10px 0 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .cs-data-request-export-scope li { display: flex; align-items: flex-start; gap: 8px; color: #48627d; font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-export-scope li svg {--cs-action-icon-size:16px; width: 16px; height: 16px; margin-top: 2px; color: #26836b; }
  .cs-data-request-export-description { color: var(--dr-muted); font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-export-actions { display: flex; flex-direction: column; gap: 9px; margin-top: 18px; }
  .cs-data-request-export-note { padding-top: 14px; margin-top: 18px !important; border-top: 1px solid #e7edf5; }
  .cs-data-request-history { margin-top: 22px; }
  .cs-data-request-history-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 20px; }
  .cs-data-request-history-heading .cs-data-request-heading { margin-bottom: 0; flex: 1 1 220px; }
  .cs-data-request-history-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
  .cs-data-request-list { display: flex; flex-direction: column; gap: 10px; }
  .cs-data-request-item { min-width: 0; border: 1px solid #dfe8f2; border-radius: 14px; background: #fff; overflow: hidden; }
  .cs-data-request-item[open] { border-color: #bfd4eb; background: #fcfdff; }
  .cs-data-request-item summary { display: grid; grid-template-columns: minmax(0, 1fr) auto 20px; align-items: center; gap: 16px; padding: 16px; cursor: pointer; list-style: none; border-radius: 13px; }
  .cs-data-request-item summary:focus-visible { outline-offset: -3px; }
  .cs-data-request-item summary::-webkit-details-marker { display: none; }
  .cs-data-request-item summary::marker { content: ''; }
  .cs-data-request-item-title { min-width: 0; }
  .cs-data-request-item-title strong { display: block; font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; overflow-wrap: anywhere; }
  .cs-data-request-item-title > span { display: block; margin-top: 3px; color: #5b7088; font-size: calc(11px * var(--app-font-scale, 1)); }
  .cs-data-request-chevron { color: #6d85a0; transition: transform .16s ease; }
  .cs-data-request-item[open] .cs-data-request-chevron { transform: rotate(180deg); }
  .cs-data-request-status { max-width: 100%; min-width: 0; display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 4px 9px; border: 1px solid #d6e3f2; border-radius: 999px; background: #f2f6fb; color: #49617a; font-size: calc(11px * var(--app-font-scale, 1)); font-weight: 650; overflow-wrap: anywhere; }
  .cs-data-request-status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
  .cs-data-request-status--pending { color: #8c5d15; background: #fff7e8; border-color: #ecd7ae; }
  .cs-data-request-status--progress { color: #125eac; background: #edf5ff; border-color: #c5dcf6; }
  .cs-data-request-status--complete { color: #246747; background: #edf8f2; border-color: #c9e5d6; }
  .cs-data-request-status--rejected { color: #9b3034; background: #fff1f0; border-color: #f0cecb; }
  .cs-data-request-item-body { padding: 17px; border-top: 1px solid #e3ecf6; font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-item-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; }
  .cs-data-request-item-meta dt { color: #60758c; font-size: calc(11px * var(--app-font-scale, 1)); }
  .cs-data-request-item-meta dd { margin-top: 4px; color: #34516c; overflow-wrap: anywhere; }
  .cs-data-request-empty { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 30px 20px; text-align: center; border: 1px dashed #d5e1ed; border-radius: 16px; background: #f9fbfd; }
  .cs-data-request-empty > svg {--cs-action-icon-size:32px; color: #6787a8; width: 32px; height: 32px; margin-bottom: 2px; }
  .cs-data-request-empty h3 { font-size: calc(14px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-empty p { max-width: 43em; color: var(--dr-muted); font-size: calc(12px * var(--app-font-scale, 1)); }
  .cs-data-request-history-footer { display: flex; justify-content: center; margin-top: 18px; }
  .cs-data-request-links { display: flex; flex-direction: column; gap: 4px; }
  .cs-data-request-link { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; min-height: 48px; padding: 12px 0; border: 0; border-radius: 8px; color: #254966; background: transparent; text-align: left; cursor: pointer; }
  .cs-data-request-link + .cs-data-request-link { border-top: 1px solid #e7edf5; border-radius: 0; }
  .cs-data-request-link > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .cs-data-request-link strong { font-size: calc(13px * var(--app-font-scale, 1)); font-weight: 650; }
  .cs-data-request-link > span > span { color: var(--dr-muted); font-size: calc(11px * var(--app-font-scale, 1)); }
  .cs-data-request-link > svg {--cs-action-icon-size:16px; width: 16px; height: 16px; color: #48749f; }
  .cs-data-request-link--danger strong { color: #a24648; }
  .cs-data-request-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  @media (hover: hover) {
    .cs-data-request-button--primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(8, 95, 196, .24); }
    .cs-data-request-button--secondary:not(:disabled):hover { background: #e7f1ff; border-color: #9bbde4; }
    .cs-data-request-button--quiet:not(:disabled):hover { background: #f2f6fb; border-color: #b9cfe5; }
    .cs-data-request-type:not(.cs-data-request-type--disabled):hover { border-color: #7eacdf; background: #f4f8ff; }
    .cs-data-request-item summary:hover { background: #f5f9ff; }
  }
  @container data-request (max-width: 790px) {
    .cs-data-request-grid { grid-template-columns: minmax(0, 1fr); }
    .cs-data-request-card { padding: 20px; border-radius: 20px; }
  }
  @container data-request (max-width: 600px) {
    .cs-data-request-card { padding: 17px; }
    .cs-data-request-heading { gap: 10px; }
    .cs-data-request-item summary { grid-template-columns: minmax(0, 1fr) 20px; gap: 8px 12px; }
    .cs-data-request-item-title { grid-column: 1; }
    .cs-data-request-item summary > .cs-data-request-status { grid-column: 1; grid-row: 2; }
    .cs-data-request-chevron { grid-column: 2; grid-row: 1 / 3; }
    .cs-data-request-item-meta, .cs-data-request-contact-fields { grid-template-columns: minmax(0, 1fr); }
    .cs-data-request-form-footer > .cs-data-request-button { width: 100%; }
    .cs-data-request-history-actions { width: 100%; }
    .cs-data-request-history-actions > button { flex: 1 1 140px; }
    .cs-data-request-type { padding: 12px; gap: 8px; }
  }
  @media (max-width: 840px) { .cs-data-request-grid { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 480px) { .cs-data-request { padding: 12px; } }
  @media (prefers-reduced-motion: reduce) {
    .cs-data-request *, .cs-data-request *::before, .cs-data-request *::after { animation: none !important; transition: none !important; }
    .cs-data-request-button:not(:disabled):hover { transform: none !important; }
  }
`;
