import { employeePortalDesign as glass } from '@/components/portal/employee/employeePortalDesign';

export const documentationCss = `
.cs-doc-viewport {
  position:relative; display:flex; flex-direction:column; flex:1; width:100%; height:100%; min-width:0; min-height:0;
  overflow:hidden;
}
.cs-doc {
  --ink:${glass.text}; --muted:${glass.muted}; --line:${glass.line}; --accent:${glass.accent};
  --canvas:${glass.canvas}; --panel:${glass.panel}; --raised:${glass.raised}; --control:${glass.control}; --selected:${glass.selected};
  --category:var(--muted); --category-wash:rgba(200,220,238,.12);
  color:var(--ink); color-scheme:dark; font-family:'CareSuite Century Gothic','Century Gothic',system-ui,sans-serif;
  font-size:calc(14px * var(--app-font-scale,1));
}
.cs-doc-workspace {
  position:relative; flex:1; width:100%; height:100%; min-width:0; min-height:0;
  overflow-y:auto; overflow-x:hidden; overscroll-behavior-y:contain; touch-action:pan-y;
  padding:clamp(12px,2vw,28px); scrollbar-width:thin; scrollbar-color:rgba(188,238,255,.38) transparent;
}
.cs-doc-board {
  display:flex; flex-direction:column; gap:16px; width:100%; max-width:1440px; min-width:0; margin:0 auto;
  container:documentation-board / inline-size;
}
.cs-doc,.cs-doc * { box-sizing:border-box }
.cs-doc h1,.cs-doc h2,.cs-doc h3,.cs-doc p { margin:0 }
.cs-doc button,.cs-doc input,.cs-doc select,.cs-doc textarea { font-family:inherit }
.cs-doc button { cursor:pointer }
.cs-doc button:disabled { cursor:default; opacity:.58 }
.cs-doc button:focus-visible,.cs-doc a:focus-visible,.cs-doc input:focus-visible,.cs-doc select:focus-visible,.cs-doc textarea:focus-visible {
  outline:2px solid var(--accent); outline-offset:2px;
}

.cs-doc-head {
  display:flex; align-items:center; justify-content:space-between; gap:18px; padding:23px;
  border:1px solid var(--line); border-radius:24px; overflow:hidden;
  background:linear-gradient(120deg,rgba(120,182,217,.21),rgba(29,58,86,.48) 51%,rgba(43,123,136,.29));
}
.cs-doc-hero-copy { flex:1; min-width:0; max-width:760px; display:flex; flex-direction:column; align-items:flex-start; gap:7px }
.cs-doc-eyebrow { color:var(--accent); font-size:calc(10px * var(--app-font-scale,1)); line-height:1.45; font-weight:700; letter-spacing:.11em; text-transform:uppercase }
.cs-doc-head .cs-doc-eyebrow::before { content:''; display:inline-block; vertical-align:middle; width:17px; height:2px; margin-right:8px; border-radius:1px; background:var(--accent) }
.cs-doc h1 { color:var(--ink); font-size:calc(40px * var(--app-font-scale,1)); line-height:1.16; font-weight:800; letter-spacing:-.7px; hyphens:auto; overflow-wrap:anywhere }
.cs-doc-intro { color:var(--muted); line-height:1.5; font-size:calc(13px * var(--app-font-scale,1)) }
.cs-doc-hero-copy .cs-doc-actions { margin-top:7px }
.cs-doc-hero-art {
  display:none; align-items:center; justify-content:center; width:156px; height:156px; flex-shrink:0;
  border:1px solid rgba(188,238,255,.25); border-radius:100%; margin:0 14px;
  background:radial-gradient(ellipse at center,rgba(133,211,246,.2),rgba(133,211,246,0) 73%);
}
.cs-doc-hero-art > .cs-desktop-catalog-artwork { max-width:90%; max-height:90% }
.cs-doc-actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0 }
.cs-doc-btn,.cs-doc-tabs button,.cs-doc-chip {
  display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; max-width:100%;
  border:1px solid var(--line); border-radius:11px; background:var(--control); color:var(--ink);
  padding:8px 12px; font-size:calc(13px * var(--app-font-scale,1)); line-height:1.35; font-weight:700;
  text-align:center; text-decoration:none; overflow-wrap:anywhere;
}
.cs-doc-btn.primary { background:var(--accent); color:var(--canvas); border-color:var(--accent) }
.cs-doc-btn.icon { flex-shrink:0; min-width:44px; padding:5px; font-size:calc(19px * var(--app-font-scale,1)) }
.cs-doc-refresh-icon { display:none; font-size:calc(20px * var(--app-font-scale,1)); line-height:1 }
.cs-doc-btn[aria-pressed=true],.cs-doc-btn[aria-expanded=true],.cs-doc-tabs button[aria-pressed=true] {
  border-color:var(--accent); background:var(--selected); color:var(--ink);
}
.cs-doc-btn:not(:disabled):hover,.cs-doc-tabs button:hover,.cs-doc-chip:hover { border-color:var(--accent) }
.cs-doc-btn.primary:not(:disabled):hover { background:#def7ff }

.cs-doc-controls,.cs-doc-panel,.cs-doc-loading,.cs-doc-empty {
  border:1px solid var(--line); border-radius:19px; background:var(--panel); min-width:0;
}
.cs-doc-controls { padding:12px; display:flex; flex-direction:column; gap:12px }
.cs-doc-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; min-width:0 }
.cs-doc-tabs { display:flex; flex-wrap:wrap; gap:4px; padding:4px; border:1px solid var(--line); border-radius:14px; background:var(--control); min-width:0 }
.cs-doc-tabs button { border-color:transparent; background:transparent; color:var(--muted) }
.cs-doc-month { display:flex; align-items:center; gap:6px; min-width:0; max-width:100% }
.cs-doc-month select { flex:1; min-width:0 }
.cs-doc-month-prev { order:-1 }
.cs-doc-search-row { display:flex; flex-wrap:wrap; align-items:flex-end; gap:8px; min-width:0 }
.cs-doc-search { flex:1 1 235px; min-width:0 }
.cs-doc-filter-toggle { align-self:flex-end }
.cs-doc label { display:flex; flex-direction:column; gap:6px; color:var(--muted); font-size:calc(12px * var(--app-font-scale,1)); font-weight:700; min-width:0 }
.cs-doc .cs-doc-scope-select { display:none; width:100% }
.cs-doc input,.cs-doc select,.cs-doc textarea {
  width:100%; min-width:0; min-height:44px; max-width:100%; padding:9px 11px; border-radius:10px;
  border:1px solid var(--line); background:var(--control); color:var(--ink);
  font-size:calc(13px * var(--app-font-scale,1)); line-height:1.45;
}
.cs-doc input::placeholder,.cs-doc textarea::placeholder { color:var(--muted); opacity:.78 }
.cs-doc select option { background:#1e3449; color:var(--ink) }
.cs-doc textarea { min-height:126px; resize:vertical }
.cs-doc-filter-block { border-top:1px solid var(--line); padding-top:12px; display:flex; flex-direction:column; gap:12px; min-width:0 }
.cs-doc-filters,.cs-doc-form-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:10px }
.cs-doc-categories { display:flex; flex-wrap:wrap; gap:7px; min-width:0 }
.cs-doc-chip {
  border-radius:99px; color:var(--category); background:var(--category-wash);
  font-size:calc(12px * var(--app-font-scale,1));
}
.cs-doc-chip[aria-pressed=true] { border-color:var(--category); background:var(--control) }
.cs-doc-dot { display:inline-block; flex-shrink:0; width:6px; height:6px; border-radius:6px; background:var(--category) }

.cs-doc-layout { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0 }
.cs-doc-list-pane { min-width:0; container-type:inline-size }
.cs-doc-summary {
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;
}
.cs-doc-summary-copy { display:flex; align-items:baseline; flex-wrap:wrap; gap:5px 10px; min-width:0 }
.cs-doc-summary h2,.cs-doc-panel h2,.cs-doc-editor h2 { color:var(--ink); font-size:calc(18px * var(--app-font-scale,1)); line-height:1.3; font-weight:800 }
.cs-doc-summary p { color:var(--muted); font-size:calc(12px * var(--app-font-scale,1)); line-height:1.45 }
.cs-doc-summary strong { color:var(--accent); font-weight:800; font-variant-numeric:tabular-nums }
.cs-doc-list { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; min-width:0 }
.cs-doc-category-care { --category:#a7efd6; --category-wash:rgba(86,203,163,.16) }
.cs-doc-category-health { --category:#ffc8dd; --category-wash:rgba(226,104,151,.16) }
.cs-doc-category-communication { --category:#c6dbff; --category-wash:rgba(109,158,246,.17) }
.cs-doc-category-organisation { --category:#ffe0aa; --category-wash:rgba(236,172,83,.16) }
.cs-doc-category-personnel { --category:#e2d3ff; --category-wash:rgba(172,136,236,.17) }
.cs-doc-category-incident { --category:#ffd0ce; --category-wash:rgba(234,116,116,.17) }
.cs-doc-card {
  display:flex; flex-direction:column; width:100%; min-width:0; gap:12px; text-align:left; color:var(--ink);
  padding:14px; border:1px solid var(--line); border-left:3px solid var(--category); border-radius:18px; background:var(--panel);
}
.cs-doc-card:hover,.cs-doc-card[aria-expanded=true] { border-color:var(--category); background:var(--raised) }
.cs-doc-card-main { display:flex; flex:1; align-items:flex-start; gap:12px; min-width:0 }
.cs-doc-date {
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; width:80px; flex-shrink:0;
  padding:7px 6px; border:1px solid var(--line); border-radius:12px; background:var(--control); text-align:center;
  color:var(--accent); font-size:calc(11px * var(--app-font-scale,1)); line-height:1.35; font-variant-numeric:tabular-nums;
}
.cs-doc-date strong { font-size:calc(28px * var(--app-font-scale,1)); line-height:1.12; color:var(--ink); font-weight:800 }
.cs-doc-date-time { color:var(--muted); font-weight:700 }
.cs-doc-card-copy { display:flex; flex:1; min-width:0; flex-direction:column; align-items:flex-start; gap:7px }
.cs-doc-card-top,.cs-doc-card-meta,.cs-doc-card-bottom,.cs-doc-reader-meta {
  display:flex; flex-wrap:wrap; align-items:center; gap:5px 9px; min-width:0;
}
.cs-doc-badge,.cs-doc-priority {
  display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:8px;
  color:var(--category); background:var(--category-wash); font-size:calc(11px * var(--app-font-scale,1)); line-height:1.35; font-weight:700;
}
.cs-doc-priority { background:rgba(236,172,83,.16); color:${glass.warning} }
.cs-doc-priority.urgent { background:rgba(234,116,116,.19); color:${glass.danger} }
.cs-doc-card-title { color:var(--ink); font-size:calc(17px * var(--app-font-scale,1)); line-height:1.35; font-weight:800; overflow-wrap:anywhere }
.cs-doc-preview {
  color:var(--muted); font-size:calc(13px * var(--app-font-scale,1)); line-height:1.55;
  overflow:hidden; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3;
}
.cs-doc-list.compact .cs-doc-preview { display:none }
.cs-doc-list.compact .cs-doc-card { padding:11px; gap:9px }
.cs-doc-card-bottom {
  justify-content:space-between; gap:6px 10px; border-top:1px solid var(--line); padding-top:9px;
  color:var(--muted); font-size:calc(11px * var(--app-font-scale,1)); line-height:1.45;
}
.cs-doc-card-meta { flex:1 1 180px; overflow-wrap:anywhere }
.cs-doc-card-meta strong { color:var(--ink) }
.cs-doc-read-label { color:var(--accent); font-weight:700 }
.cs-doc-pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:10px; padding-top:14px; color:var(--muted) }

.cs-doc-notice,.cs-doc-error,.cs-doc-empty,.cs-doc-loading { padding:14px; line-height:1.5 }
.cs-doc-notice { background:rgba(87,194,150,.14); border:1px solid rgba(151,236,196,.44); color:#c3f6dd; border-radius:12px }
.cs-doc-error { background:rgba(221,112,133,.17); border:1px solid rgba(255,183,194,.43); color:${glass.danger}; border-radius:12px }
.cs-doc-error .cs-doc-btn { margin-top:6px }
.cs-doc-empty { display:flex; flex-direction:column; align-items:flex-start; gap:8px; color:var(--muted) }
.cs-doc-empty h3 { color:var(--ink) }
.cs-doc-loading,.cs-doc-hint { color:var(--muted) }
.cs-doc-hint { font-size:calc(12px * var(--app-font-scale,1)); line-height:1.55; overflow-wrap:anywhere }

.cs-doc-panel { background:#1b3147; overflow:hidden; container-type:inline-size }
.cs-doc-panel-head,.cs-doc-reader-head {
  display:flex; justify-content:space-between; align-items:flex-start; gap:8px; padding:15px;
  border-bottom:1px solid var(--line); background:#213a51;
}
.cs-doc-panel-head > div,.cs-doc-reader-head > div { flex:1; min-width:0 }
.cs-doc-panel-body { padding:15px; display:flex; flex-direction:column; gap:12px; min-width:0 }
.cs-doc-form-content { display:flex; flex-direction:column; gap:12px; min-width:0 }
.cs-doc-full { grid-column:1 / -1 }
.cs-doc-uploads,.cs-doc-file {
  border:1px solid var(--line); border-radius:13px; background:var(--panel); padding:12px; min-width:0;
}
.cs-doc-uploads { display:flex; flex-direction:column; gap:9px }
.cs-doc-upload-heading { display:flex; flex-wrap:wrap; justify-content:space-between; gap:5px 9px }
.cs-doc-upload-heading span,.cs-doc-file-heading small,.cs-doc-pending small { color:var(--muted); font-size:calc(11px * var(--app-font-scale,1)) }
.cs-doc .cs-doc-dropzone { padding:10px; border:1px dashed var(--line); border-radius:10px; background:var(--control); line-height:1.45 }
.cs-doc-dropzone input { padding:4px 0; border:0; background:transparent }
.cs-doc-dropzone input::file-selector-button { background:var(--selected); border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:8px; font:inherit; margin-right:8px; cursor:pointer }
.cs-doc .recording { background:rgba(221,112,133,.17); color:${glass.danger}; border-color:${glass.danger} }
.cs-doc-pending { display:grid; gap:8px; list-style:none; padding:0; margin:0 }
.cs-doc-pending li,.cs-doc-file-heading { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0 }
.cs-doc-pending li > span:nth-child(2),.cs-doc-file-heading > div { flex:1; min-width:0 }
.cs-doc-pending strong,.cs-doc-file-heading strong { display:block; overflow-wrap:anywhere }
.cs-doc-pending small,.cs-doc-file-heading small { display:block; margin-top:3px }
.cs-doc-file-icon {
  display:flex; justify-content:center; align-items:center; width:44px; min-height:43px;
  background:var(--control); color:var(--accent); border:1px solid var(--line); border-radius:9px;
  font-size:calc(9px * var(--app-font-scale,1)); font-weight:700; overflow-wrap:anywhere;
}
.cs-doc-files { display:grid; gap:10px; border-top:1px solid var(--line); margin-top:19px; padding-top:14px }
.cs-doc-files h3 span { color:var(--muted); margin-left:7px }
.cs-doc-file-preview { display:flex; flex-wrap:wrap; align-items:center; gap:9px; margin-top:11px }
.cs-doc-file-preview img,.cs-doc-file-preview video { display:block; max-width:100%; max-height:60dvh; object-fit:contain; border-radius:10px; background:var(--control); margin:auto }
.cs-doc-file-preview audio { width:100% }
.cs-doc-file-preview iframe { width:100%; height:58dvh; min-height:235px; border:1px solid var(--line); border-radius:10px }
.cs-doc-file-preview > p { width:100% }

.cs-doc.cs-doc-reader {
  width:min(1120px,calc(100vw - 40px)); max-width:none; max-height:min(940px,calc(100dvh - 40px));
  min-height:min(400px,calc(100dvh - 40px)); margin:auto; padding:0; border:1px solid var(--line); border-radius:22px; overflow:hidden;
  background:#182d43; box-shadow:0 24px 80px rgba(4,12,24,.55);
}
.cs-doc-reader[open] { display:flex; flex-direction:column }
.cs-doc-reader::backdrop { background:rgba(8,24,42,.76); backdrop-filter:blur(6px) }
.cs-doc-reader-head { flex:none; padding:17px 20px }
.cs-doc-reader-head h2 { margin-top:4px; color:var(--ink); font-size:calc(23px * var(--app-font-scale,1)); line-height:1.3; overflow-wrap:anywhere; max-height:3.9em; overflow-y:auto }
.cs-doc-reader-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior-y:contain; scrollbar-width:thin; scrollbar-color:rgba(188,238,255,.38) transparent }
.cs-doc-reading-width { width:100%; max-width:840px; margin:auto; padding:22px 23px 32px; min-width:0 }
.cs-doc-reader-meta { color:var(--muted); font-size:calc(12px * var(--app-font-scale,1)) }
.cs-doc-reader-person { color:var(--accent); margin:13px 0 16px; border-bottom:1px solid var(--line); padding-bottom:11px; font-weight:700; overflow-wrap:anywhere }
.cs-doc-copy { color:var(--ink); white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.8 }
.cs-doc-reader-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; flex:none; padding:11px 16px; border-top:1px solid var(--line); background:#213a51 }
.cs-doc-reader-footer span { color:var(--muted); font-size:calc(12px * var(--app-font-scale,1)) }

.cs-doc.cs-doc-editor {
  width:min(1060px,calc(100vw - 40px)); height:min(850px,calc(100dvh - 40px)); max-width:none; max-height:none;
  margin:auto; padding:0; border:1px solid var(--line); border-radius:22px; overflow:hidden;
  background:#182d43; box-shadow:0 24px 80px rgba(4,12,24,.55); container-type:inline-size;
}
.cs-doc-editor[open] { display:flex; flex-direction:column }
.cs-doc-editor::backdrop { background:rgba(8,24,42,.76); backdrop-filter:blur(6px) }
.cs-doc-editor .cs-doc-panel-head { flex:none; align-items:center; padding:16px 22px }
.cs-doc-editor h2 { margin-top:3px; font-size:calc(23px * var(--app-font-scale,1)) }
.cs-doc-editor .cs-doc-panel-body { flex:1 1 auto; min-height:0; padding:0; gap:0 }
.cs-doc-editor .cs-doc-panel-body > .cs-doc-error { flex:none; margin:10px 22px 0 }
.cs-doc-editor .cs-doc-form-content {
  flex:1 1 auto; min-height:0; gap:10px; padding:14px 22px 18px; overflow-y:auto; overflow-x:hidden;
  overscroll-behavior-y:contain; scrollbar-width:thin; scrollbar-color:rgba(188,238,255,.38) transparent;
}
.cs-doc-editor textarea { min-height:clamp(190px,26dvh,320px); font-size:calc(15px * var(--app-font-scale,1)); line-height:1.6 }
.cs-doc-editor .cs-doc-editor-actions {
  flex:none; justify-content:flex-end; padding:10px 22px; border-top:1px solid var(--line); background:#213a51;
}

@container (min-width:340px) {
  .cs-doc-editor .cs-doc-form-grid { grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr) }
}
@container (min-width:580px) {
  .cs-doc-filters,.cs-doc-form-grid,.cs-doc-editor .cs-doc-form-grid { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .cs-doc-editor .cs-doc-dropzone { flex-direction:row; align-items:center; justify-content:space-between; gap:12px; padding:6px 10px }
  .cs-doc-editor .cs-doc-dropzone input { width:auto; padding:0 }
}
@container (min-width:650px) {
  .cs-doc-hero-art { display:flex }
}
@container (min-width:760px) {
  .cs-doc-editor .cs-doc-form-grid { grid-template-columns:repeat(3,minmax(0,1fr)) }
}
@container (min-width:850px) {
  .cs-doc-list { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .cs-doc-filters { grid-template-columns:repeat(4,minmax(0,1fr)) }
}
@container documentation-board (min-width:1060px) {
  .cs-doc-layout.has-panel { grid-template-columns:minmax(0,1fr) minmax(360px,420px); align-items:start }
  .cs-doc-layout.has-panel > .cs-doc-panel { grid-column:2; grid-row:1 }
  .cs-doc-layout.has-panel > .cs-doc-list-pane { grid-column:1; grid-row:1 }
  .cs-doc-layout.has-panel .cs-doc-list { grid-template-columns:minmax(0,1fr) }
}
@container (max-width:540px) {
  .cs-doc-head { padding:14px; border-radius:19px }
  .cs-doc h1 { font-size:calc(25px * var(--app-font-scale,1)) }
  .cs-doc-card-main { flex-direction:column; gap:8px }
  .cs-doc-date { flex-direction:row; justify-content:flex-start; flex-wrap:wrap; width:auto; max-width:100%; gap:5px; padding:5px 7px }
  .cs-doc-date strong { font-size:inherit }
  .cs-doc-card-copy { width:100% }
  .cs-doc-tabs { width:100% }
  .cs-doc-tabs button { flex:1 0 auto; min-width:0; padding:6px }
  .cs-doc-month { width:100% }
  .cs-doc-controls { padding:9px }
}
@container (max-width:340px) {
  .cs-doc-tabs { display:none }
  .cs-doc .cs-doc-scope-select { display:flex }
  .cs-doc-refresh { min-width:44px; padding:5px }
  .cs-doc-refresh-label { display:none }
  .cs-doc-refresh-icon { display:inline-block }
}
@container (max-width:17em) {
  .cs-doc-month { flex-wrap:wrap }
  .cs-doc-month select { flex:1 0 100% }
  .cs-doc-month button { flex:1 0 44px; order:0 }
}
@media (orientation:landscape) and (max-height:540px) {
  .cs-doc-workspace { padding:10px 14px }
  .cs-doc-board { gap:10px }
  .cs-doc-head { gap:12px; padding:11px 14px; border-radius:17px }
  .cs-doc h1 { font-size:calc(27px * var(--app-font-scale,1)) }
  .cs-doc-hero-copy { gap:3px 12px }
  .cs-doc-hero-art { width:74px; height:74px; margin:0 }
  .cs-doc-controls { padding:9px; gap:8px }
  @container (min-width:620px) {
    .cs-doc-hero-copy { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center }
    .cs-doc-hero-copy > p,.cs-doc-hero-copy > h1 { grid-column:1 }
    .cs-doc-hero-copy .cs-doc-actions { grid-column:2; grid-row:1 / 4; max-width:32vw; margin:0 }
  }
}
@media(max-width:680px) {
  .cs-doc.cs-doc-reader { width:calc(100vw - 12px); height:calc(100dvh - 12px); min-height:0; max-height:none; border-radius:17px }
  .cs-doc-reader-head { padding:12px }
  .cs-doc-reader-head h2 { font-size:calc(17px * var(--app-font-scale,1)) }
  .cs-doc-reading-width { padding:15px 12px 23px }
  .cs-doc-reader-footer { padding:8px }
  .cs-doc-reader-footer .cs-doc-btn { padding:6px 8px }
}
@media (max-width:680px), (orientation:landscape) and (max-height:500px) {
  .cs-doc.cs-doc-editor { width:min(1060px,calc(100vw - 12px)); height:calc(100dvh - 12px); border-radius:17px }
  .cs-doc-editor .cs-doc-panel-head,.cs-doc-editor .cs-doc-editor-actions { padding:10px 12px }
  .cs-doc-editor .cs-doc-form-content { padding:12px }
  .cs-doc-editor .cs-doc-panel-body > .cs-doc-error { margin:8px 12px 0 }
}
@media (orientation:landscape) and (max-height:500px) and (min-width:760px) {
  .cs-doc-editor .cs-doc-form-grid { grid-template-columns:minmax(0,.85fr) minmax(0,1.05fr) repeat(2,minmax(0,1fr)) }
  .cs-doc-editor .cs-doc-full { grid-column:3 / -1 }
  .cs-doc-editor .cs-doc-full:nth-last-child(2) { grid-row:1 }
  .cs-doc-editor .cs-doc-full:last-child { grid-row:2 / 4 }
  .cs-doc-editor textarea { min-height:140px }
}
`;
