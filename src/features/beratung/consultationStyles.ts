/** Scoped ORBIT / Liquid Glass surfaces; the existing desktop and portal shell stay in control. */
export const consultationStyles = String.raw `
.cw-root {
  --cw-ink:#10233f;
  --cw-muted:#54677e;
  --cw-blue:#056ce8;
  --cw-border:rgba(125,155,192,.24);
  color:var(--cw-ink);
  font:400 14px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  width:100%;
  height:100%;
  min-height:0;
  overflow:auto;
  overscroll-behavior-y:contain;
  container-type:inline-size;
  background:radial-gradient(ellipse at 84% 0%,rgba(204,229,255,.5),transparent 48%),linear-gradient(160deg,rgba(248,251,255,.7),rgba(236,245,255,.48));
  color-scheme:light
}
.cw-root * {
  box-sizing:border-box
}
.cw-workspace {
  max-width:1430px;
  padding:34px clamp(16px,3vw,42px) 50px;
  margin:0 auto;
  min-width:0
}
.cw-root h1,.cw-root h2,.cw-root h3,.cw-root h4,.cw-root p {
  margin-top:0
}
.cw-root h1 {
  font-size:clamp(25px,3vw,35px);
  line-height:1.16;
  letter-spacing:-1px;
  font-weight:670;
  margin-bottom:11px;
  text-wrap:balance
}
.cw-root h2 {
  font-size:19px;
  line-height:1.3;
  letter-spacing:-.35px;
  font-weight:650;
  margin-bottom:14px
}
.cw-root h3 {
  font-size:15px;
  margin:22px 0 12px
}
.cw-root p {
  overflow-wrap:anywhere
}
.cw-kicker {
  font-size:10px;
  line-height:1.5;
  font-weight:750;
  letter-spacing:1.65px;
  color:#5c7594;
  margin-bottom:12px!important
}
.cw-kicker span {
  margin:0 9px;
  color:#9bb1cc
}
.cw-subtitle {
  font-size:14px;
  color:var(--cw-muted);
  max-width:700px;
  margin-bottom:0
}
.cw-header {
  display:flex;
  gap:24px;
  align-items:center;
  justify-content:space-between;
  margin-bottom:30px
}
.cw-header-actions,.cw-actions {
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap
}
.cw-header-actions {
  flex-shrink:0;
  justify-content:flex-end
}
.cw-root button,.cw-root input,.cw-root select,.cw-root textarea {
  font:inherit
}
.cw-root button {
  cursor:pointer
}
.cw-root button:disabled {
  cursor:default;
  opacity:.52
}
.cw-root :focus-visible {
  outline:3px solid #488eff;
  outline-offset:3px
}
.cw-button {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  min-height:42px;
  padding:10px 16px;
  border:1px solid rgba(112,148,189,.3);
  border-radius:11px;
  background:rgba(255,255,255,.82);
  box-shadow:0 2px 4px rgba(23,65,107,.025);
  color:var(--cw-ink);
  font-size:13px!important;
  font-weight:600!important;
  text-decoration:none;
  text-align:center;
  white-space:normal;
  transition:background .16s,box-shadow .16s;
  max-width:100%
}
.cw-button:hover:not(:disabled) {
  background:#f0f7ff;
  box-shadow:0 4px 10px #1a4d8010
}
.cw-primary {
  background:linear-gradient(140deg,#147df4,#0564d9);
  color:#fff;
  border-color:#086ae1;
  box-shadow:0 4px 12px #056ce826
}
.cw-primary:hover:not(:disabled) {
  background:#045ccb;
  box-shadow:0 6px 15px #056ce82e
}
.cw-link {
  border:0;
  background:transparent;
  color:#075ebc;
  min-height:38px;
  padding:5px 2px;
  font-weight:600!important;
  text-align:left;
  font-size:12px!important
}
.cw-link:hover {
  text-decoration:underline
}
.cw-icon-button {
  width:38px;
  height:38px;
  border:1px solid var(--cw-border);
  border-radius:50%;
  font-size:25px!important;
  background:#f4f8fe;
  flex-shrink:0;
  color:#405570
}
.cw-panel,.cw-metric {
  background:rgba(255,255,255,.76);
  border:1px solid rgba(255,255,255,.94);
  border-radius:20px;
  box-shadow:0 8px 36px rgba(41,79,127,.055),0 1px 3px rgba(41,79,127,.06);
  backdrop-filter:blur(22px)
}
.cw-panel {
  padding:25px
}
.cw-metrics {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:16px;
  margin:0 0 25px
}
.cw-metric {
  text-align:left;
  padding:19px 22px;
  display:flex;
  flex-direction:column;
  position:relative;
  overflow:hidden;
  transition:transform .18s,border-color .18s;
  color:var(--cw-ink);
  min-height:158px
}
.cw-metric::after {
  content:'';
  position:absolute;
  width:100px;
  height:100px;
  right:-26px;
  top:-34px;
  border-radius:100%;
  background:var(--metric-color);
  opacity:.07
}
.cw-metric>span {
  font-size:12px;
  font-weight:600;
  color:var(--cw-muted)
}
.cw-metric strong {
  font-size:34px;
  line-height:1.4;
  font-weight:650;
  letter-spacing:-1px;
  color:var(--metric-color);
  margin:6px 0 10px
}
.cw-metric small {
  font-size:11px;
  color:var(--cw-muted);
  display:flex;
  justify-content:space-between;
  gap:8px
}
.cw-metric[aria-pressed=true] {
  border-color:var(--metric-color);
  box-shadow:0 0 0 1px var(--metric-color)
}
.cw-metric:hover {
  transform:translateY(-2px)
}
.cw-tone-blue {
  --metric-color:#086edf
}
.cw-tone-violet {
  --metric-color:#7255c6
}
.cw-tone-amber {
  --metric-color:#a5650c
}
.cw-tone-green {
  --metric-color:#168060
}
.cw-list-panel {
  padding:26px 26px 8px
}
.cw-list-heading,.cw-between {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px
}
.cw-list-heading {
  margin-bottom:16px
}
.cw-list-heading .cw-kicker {
  margin-bottom:6px!important
}
.cw-list-heading h2 {
  margin-bottom:0
}
.cw-filter-row {
  display:grid;
  grid-template-columns:minmax(180px,1.7fr) minmax(150px,1fr) minmax(150px,1fr);
  gap:14px;
  padding-bottom:10px
}
.cw-field {
  display:flex;
  flex-direction:column;
  gap:7px;
  font-size:12px;
  font-weight:600;
  margin:0 0 18px;
  min-width:0
}
.cw-field input,.cw-field select,.cw-field textarea {
  min-height:44px;
  width:100%;
  min-width:0;
  padding:10px 12px;
  border-radius:10px;
  border:1px solid #ccdae9;
  background:rgba(255,255,255,.9);
  color:var(--cw-ink);
  font-size:14px!important;
  box-shadow:inset 0 1px 2px #18334f03
}
.cw-field textarea {
  resize:vertical;
  min-height:110px;
  line-height:1.6
}
.cw-field input::placeholder,.cw-field textarea::placeholder {
  color:#77899d;
  font-weight:400
}
.cw-field small,.cw-muted {
  font-size:12px;
  color:var(--cw-muted);
  font-weight:400
}
.cw-filter-row .cw-field {
  margin-bottom:8px
}
.cw-list-meta {
  display:flex;
  justify-content:space-between;
  gap:12px;
  font-size:11px;
  color:var(--cw-muted);
  padding:0 1px 13px;
  border-bottom:1px solid var(--cw-border)
}
.cw-visits {
  display:flex;
  flex-direction:column
}
.cw-visit {
  display:grid;
  grid-template-columns:50px minmax(150px,1.3fr) minmax(155px,1fr) minmax(160px,1fr) 20px;
  gap:16px;
  width:100%;
  padding:23px 2px;
  background:transparent;
  border:0;
  border-bottom:1px solid #e6edf6;
  text-align:left;
  color:var(--cw-ink);
  align-items:center;
  border-radius:9px
}
.cw-visit:last-child {
  border-bottom:0
}
.cw-visit:hover {
  background:rgba(234,245,255,.55)
}
.cw-visit-icon {
  height:48px;
  width:48px;
  display:grid;
  place-items:center;
  border-radius:15px;
  color:#0870dd;
  background:linear-gradient(140deg,#eaf4ff,#dfeeff);
  font-size:13px;
  font-weight:700;
  border:1px solid #d8e8fa
}
.cw-training {
  color:#7853b9;
  background:linear-gradient(140deg,#f3edff,#ece7fc);
  border-color:#e5dcf4
}
.cw-visit-person,.cw-visit-date,.cw-visit-progress {
  display:flex;
  flex-direction:column;
  gap:4px;
  min-width:0;
  overflow-wrap:anywhere
}
.cw-visit-person strong {
  font-size:14px
}
.cw-visit-person>span {
  font-size:12px;
  color:#536c88
}
.cw-visit small {
  font-size:11px;
  color:#61748d
}
.cw-visit-date strong {
  font-size:12px;
  font-weight:600
}
.cw-visit-progress {
  align-items:flex-start;
  gap:7px
}
.cw-visit-arrow {
  font-size:19px;
  color:#7193bb
}
.cw-status {
  display:inline-flex;
  align-items:center;
  font-size:10px;
  font-weight:650;
  padding:5px 9px;
  border-radius:7px;
  background:#edf2f8;
  color:#46607f;
  gap:6px;
  line-height:1.5
}
.cw-status::before {
  content:'';
  width:5px;
  height:5px;
  border-radius:50%;
  background:currentColor;
  flex-shrink:0
}
.cw-status-scheduled {
  background:#edf4ff;
  color:#2869b1
}
.cw-status-in_progress {
  background:#e6f1ff;
  color:#005bb9
}
.cw-status-documentation_pending {
  background:#fff5e6;
  color:#986217
}
.cw-status-returned {
  background:#fff1df;
  color:#9b5c08
}
.cw-status-submitted {
  background:#f0ebfc;
  color:#7151ac
}
.cw-status-approved {
  background:#e8f6f0;
  color:#237959
}
.cw-status-cancelled,.cw-status-no_show {
  background:#f1f2f5;
  color:#687180
}
.cw-bottom-notes {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
  font-size:11px;
  color:#607691;
  margin:20px 2px
}
.cw-bottom-notes>div {
  display:flex;
  gap:9px;
  align-items:center
}
.cw-bottom-notes p {
  margin:0
}
.cw-dot {
  background:#1ca782;
  box-shadow:0 0 0 4px #1ca78213;
  width:6px;
  height:6px;
  border-radius:50%;
  flex-shrink:0
}
.cw-empty {
  text-align:center;
  padding:50px 20px;
  color:var(--cw-muted);
  max-width:650px;
  margin:0 auto
}
.cw-empty-icon {
  display:inline-grid;
  place-items:center;
  width:64px;
  height:64px;
  border:1px solid #dbe6f5;
  border-radius:22px;
  background:#eef6ff;
  color:#4385c7;
  font-size:30px
}
.cw-empty h3 {
  font-size:18px;
  color:var(--cw-ink)
}
.cw-empty p {
  font-size:13px;
  max-width:500px;
  margin:0 auto 20px
}
.cw-loading {
  min-height:240px;
  display:flex;
  gap:14px;
  justify-content:center;
  align-items:center;
  color:var(--cw-muted)
}
.cw-spinner {
  width:22px;
  height:22px;
  border:2px solid #cadff5;
  border-top-color:#1872d6;
  border-radius:50%;
  animation:cw-spin 1s linear infinite
}
@keyframes cw-spin {
  to {
    transform:rotate(360deg)
  }
}
.cw-alert {
  border:1px solid #cfdff1;
  background:#f0f7ff;
  border-radius:13px;
  padding:14px 17px;
  font-size:13px;
  margin:0 0 20px
}
.cw-alert p {
  margin:7px 0
}
.cw-alert-error {
  color:#8f2437;
  background:#fff2f4;
  border-color:#f1cbd2
}
.cw-alert-warning {
  color:#825612;
  background:#fff8eb;
  border-color:#ecddbc
}
.cw-alert-success {
  color:#206d51;
  background:#ecf8f2;
  border-color:#cee6d9
}
.cw-notice {
  padding:10px 15px;
  font-size:12px
}
.cw-detail-toolbar {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:12px 18px;
  margin:0 0 18px
}
.cw-save-state {
  flex:1;
  font-size:11px;
  color:#586d87;
  text-align:right;
  min-width:180px
}
.cw-case-visits {
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:10px;
  margin-bottom:16px
}
.cw-case-visits .cw-field {
  margin:0 0 0 auto;
  min-width:240px;
  max-width:100%
}
.cw-case-visits .cw-field>span {
  font-size:10px
}
.cw-editor-grid {
  display:grid;
  grid-template-columns:260px minmax(0,1fr);
  gap:24px;
  align-items:start
}
.cw-context {
  display:flex;
  flex-direction:column;
  gap:18px;
  position:sticky;
  top:16px
}
.cw-client {
  padding:22px
}
.cw-client h2 {
  font-size:19px;
  margin-bottom:8px
}
.cw-client>p {
  font-size:12px;
  color:var(--cw-muted)
}
.cw-avatar {
  display:grid;
  place-items:center;
  width:50px;
  height:50px;
  background:linear-gradient(140deg,#c9e4ff,#e6f2ff);
  color:#337ab4;
  border:1px solid #d2e5fa;
  border-radius:18px;
  margin-bottom:15px;
  font-size:18px;
  font-weight:650
}
.cw-tags {
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  margin:12px 0
}
.cw-tag {
  display:inline-block;
  border:1px solid #dce6f1;
  border-radius:7px;
  padding:4px 8px;
  font-size:10px;
  background:#f6faff;
  color:#4d6680
}
.cw-client-details {
  margin:14px 0
}
.cw-client-details summary {
  font-size:12px;
  font-weight:600;
  cursor:pointer
}
.cw-facts {
  margin:16px 0
}
.cw-facts>div {
  padding:9px 0;
  border-top:1px solid #e4edf6
}
.cw-facts dt {
  font-size:10px;
  color:#667c94
}
.cw-facts dd {
  margin:4px 0 0;
  font-size:12px;
  font-weight:550;
  overflow-wrap:anywhere
}
.cw-section-nav {
  display:flex;
  flex-direction:column;
  gap:5px
}
.cw-section-nav button {
  border:1px solid transparent;
  min-height:49px;
  padding:9px 10px;
  display:flex;
  align-items:center;
  gap:10px;
  background:transparent;
  border-radius:12px;
  text-align:left;
  color:#546b86;
  font-size:12px
}
.cw-section-nav button[aria-current=step] {
  background:rgba(255,255,255,.9);
  border-color:#dae7f5;
  color:#075fc4;
  box-shadow:0 4px 15px #13559a06
}
.cw-step {
  width:26px;
  height:26px;
  border-radius:9px;
  background:#e5eef8;
  display:grid;
  place-items:center;
  flex-shrink:0;
  font-size:11px
}
.cw-section-nav button[aria-current=step] .cw-step {
  background:#086de1;
  color:white
}
.cw-step-dot {
  height:6px;
  width:6px;
  border-radius:50%;
  background:#d5a755;
  flex-shrink:0;
  margin-left:auto
}
.cw-small {
  padding:17px
}
.cw-small strong {
  font-size:12px
}
.cw-small p {
  font-size:11px;
  margin:7px 0 0;
  color:var(--cw-muted)
}
.cw-editor-main {
  display:flex;
  flex-direction:column;
  gap:22px;
  min-width:0
}
.cw-form-panel {
  padding:28px
}
.cw-section-heading {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:23px;
  gap:10px
}
.cw-section-heading h2 {
  font-size:23px;
  margin-bottom:0
}
.cw-section-heading .cw-kicker {
  margin-bottom:5px!important
}
.cw-reset-fieldset {
  padding:0;
  margin:0;
  border:0;
  min-width:0
}
.cw-reset-fieldset:disabled input,.cw-reset-fieldset:disabled textarea,.cw-reset-fieldset:disabled select {
  color:#4d6279;
  background:#f7f9fc;
  opacity:1
}
.cw-handover {
  padding:17px 20px;
  border:1px solid #d6e6f8;
  border-radius:13px;
  background:linear-gradient(130deg,#f1f7ff,#f7fbff);
  margin-bottom:18px
}
.cw-handover h3 {
  margin-top:0
}
.cw-handover p {
  font-size:13px;
  white-space:pre-wrap
}
.cw-handover small {
  font-size:11px;
  color:#58708c
}
.cw-form-grid {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:0 18px
}
.cw-repeat-list {
  display:flex;
  flex-direction:column;
  gap:16px;
  margin-bottom:16px
}
.cw-repeat-item {
  background:#f7faff;
  border:1px solid #e2eaf5;
  border-radius:13px;
  padding:18px
}
.cw-repeat-item .cw-between {
  margin-bottom:15px
}
.cw-repeat-item .cw-between h3 {
  margin:0
}
.cw-repeat-item .cw-field:last-child {
  margin-bottom:0
}
.cw-topic-grid {
  display:flex;
  flex-wrap:wrap;
  gap:8px
}
.cw-topic {
  display:flex;
  align-items:center;
  gap:7px;
  padding:9px 11px;
  border:1px solid #dce6f3;
  border-radius:10px;
  font-size:11px;
  background:#f8fbff;
  font-weight:500
}
.cw-topic:has(input:checked) {
  background:#eaf3ff;
  border-color:#9cc6f5;
  color:#0d61b8
}
.cw-root input[type=checkbox],.cw-root input[type=radio] {
  width:16px;
  height:16px;
  min-height:0;
  flex-shrink:0;
  accent-color:#086de1
}
.cw-form-footer {
  border-top:1px solid #e2eaf5;
  padding-top:20px;
  margin-top:26px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px
}
.cw-checklist {
  border:1px solid #e8d7b2;
  border-radius:12px;
  background:#fffaf0;
  padding:16px;
  margin:15px 0 20px
}
.cw-checklist h3 {
  margin:0 0 8px;
  color:#7e5b20
}
.cw-checklist-row {
  display:flex;
  align-items:center;
  gap:10px;
  width:100%;
  padding:9px 0;
  background:transparent;
  border:0;
  text-align:left;
  color:#775b2d;
  font-size:12px!important
}
.cw-checklist-row .cw-step-dot {
  margin-left:0
}
.cw-checklist-row>span:last-child {
  margin-left:auto
}
.cw-summary {
  margin:15px 0 20px;
  border:1px solid #d9e4f1;
  border-radius:12px;
  padding:15px;
  background:#f9fcff
}
.cw-summary summary {
  font-size:13px;
  font-weight:650;
  cursor:pointer
}
.cw-summary[open] summary {
  margin-bottom:20px
}
.cw-document {
  font-size:12px;
  overflow-wrap:anywhere;
  white-space:normal
}
.cw-document dt {
  font-weight:650;
  margin-bottom:5px
}
.cw-document dd {
  margin:0 0 16px;
  white-space:pre-wrap
}
.cw-document li {
  margin-bottom:8px
}
.cw-document p {
  white-space:pre-wrap
}
.cw-document section {
  border-top:1px solid #dce5f0;
  padding:15px 0
}
.cw-document ul {
  padding-left:20px
}
.cw-revisions {
  display:flex;
  flex-wrap:wrap;
  gap:10px
}
.cw-check {
  display:flex;
  align-items:flex-start;
  gap:10px;
  font-size:12px;
  margin:20px 0;
  line-height:1.6
}
.cw-timeline {
  list-style:none;
  padding:0 0 0 15px;
  margin:25px 0 0;
  border-left:1px solid #d9e5f2
}
.cw-timeline li {
  position:relative;
  margin:0 0 22px;
  padding-left:8px;
  font-size:12px
}
.cw-timeline li::before {
  content:'';
  position:absolute;
  left:-19px;
  top:6px;
  width:7px;
  height:7px;
  border-radius:50%;
  background:#6da1d8;
  box-shadow:0 0 0 4px #f4f9ff
}
.cw-timeline small,.cw-timeline time {
  font-size:10px;
  color:#647993
}
.cw-timeline p {
  white-space:pre-wrap;
  margin:7px 0 0
}
.cw-message-form .cw-field {
  margin-bottom:10px
}
.cw-modal {
  color:var(--cw-ink);
  background:#fbfdff;
  border:1px solid #d5e2f1;
  border-radius:22px;
  padding:25px;
  width:min(580px,calc(100vw - 30px));
  max-height:calc(100dvh - 44px);
  box-shadow:0 24px 100px #0a244736;
  overflow:auto;
  overscroll-behavior:contain;
  font:inherit
}
.cw-modal-wide {
  width:min(880px,calc(100vw - 30px))
}
.cw-modal::backdrop {
  background:rgba(16,39,68,.38);
  backdrop-filter:blur(5px)
}
.cw-modal-head {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:16px;
  margin-bottom:17px
}
.cw-modal-head h2 {
  margin:0;
  font-size:21px
}
.cw-modal>p {
  font-size:13px;
  color:#516780
}
.cw-modal .cw-actions {
  justify-content:flex-end;
  margin-top:20px
}
.cw-signature {
  margin:18px 0
}
.cw-signature strong {
  font-size:12px
}
.cw-signature canvas {
  display:block;
  width:100%;
  height:auto;
  aspect-ratio:3.5;
  border:1px solid #bfcee0;
  border-radius:12px;
  background:linear-gradient(transparent calc(76% - 1px),#e4eaf2 76%,transparent calc(76% + 1px)),#fff
}
.cw-signature small {
  display:block;
  font-size:11px;
  color:#667b93;
  margin-top:6px
}
.cw-signature-image {
  max-width:100%;
  width:250px;
  object-fit:contain;
  background:#fff;
  border-bottom:1px solid #d4deeb
}
.cw-hash {
  overflow-wrap:anywhere;
  color:#60738a;
  font-size:9px
}
.cw-conflict-field {
  border-bottom:1px solid #dde7f3;
  padding:15px 0
}
.cw-conflict-field pre {
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  font:12px/1.6 inherit;
  padding:12px;
  border:1px solid #dae5f1;
  border-radius:8px;
  max-height:250px;
  overflow:auto
}
.cw-conflict-field label {
  min-width:0
}
@container (max-width:1050px) {
  .cw-header {
    align-items:flex-start
  }
  .cw-header-actions {
    max-width:200px
  }
  .cw-editor-grid {
    grid-template-columns:220px minmax(0,1fr);
    gap:18px
  }
  .cw-form-panel {
    padding:22px
  }
  .cw-visit {
    grid-template-columns:42px minmax(140px,1.2fr) minmax(125px,1fr) minmax(135px,1fr);
    gap:12px
  }
  .cw-visit-icon {
    width:40px;
    height:44px
  }
  .cw-visit-arrow {
    display:none
  }
  .cw-metric {
    padding:18px 16px
  }
  .cw-bottom-notes {
    align-items:flex-start;
    flex-direction:column;
    gap:8px
  }
}
@container (max-width:800px) {
  .cw-metrics {
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px
  }
  .cw-metric {
    min-height:132px
  }
  .cw-metric strong {
    font-size:30px;
    margin:4px 0
  }
  .cw-header {
    flex-direction:column;
    gap:18px
  }
  .cw-header-actions {
    max-width:none;
    justify-content:flex-start
  }
  .cw-editor-grid {
    grid-template-columns:minmax(0,1fr)
  }
  .cw-context {
    position:static
  }
  .cw-client {
    display:grid;
    grid-template-columns:48px minmax(0,1fr);
    gap:7px 14px;
    padding:18px
  }
  .cw-client .cw-avatar {
    grid-column:1;
    grid-row:1/3;
    margin:0;
    width:46px;
    height:46px
  }
  .cw-client h2,.cw-client>p,.cw-client .cw-tags {
    grid-column:2;
    margin:0
  }
  .cw-client-details {
    grid-column:1/-1
  }
  .cw-client>.cw-button {
    grid-column:1/-1
  }
  .cw-facts {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:0 15px
  }
  .cw-section-nav {
    flex-direction:row;
    flex-wrap:wrap;
    gap:6px
  }
  .cw-section-nav button {
    flex:1;
    min-width:130px;
    font-size:11px;
    min-height:44px
  }
  .cw-small {
    display:none
  }
  .cw-filter-row {
    grid-template-columns:repeat(2,minmax(0,1fr))
  }
  .cw-filter-row>.cw-field:first-child {
    grid-column:1/-1
  }
  .cw-list-panel {
    padding:20px 18px 5px
  }
  .cw-visit {
    grid-template-columns:42px minmax(0,1.1fr) minmax(0,1fr);
    row-gap:12px
  }
  .cw-visit-date {
    grid-column:2;
    grid-row:2
  }
  .cw-visit-progress {
    grid-column:3;
    grid-row:1/3;
    align-self:start
  }
  .cw-visit-icon {
    align-self:start
  }
  .cw-list-meta>span:last-child {
    display:none
  }
  .cw-case-visits .cw-field {
    width:100%;
    margin:5px 0
  }
  .cw-save-state {
    text-align:left;
    order:3;
    flex-basis:100%
  }
}
@container (max-width:480px) {
  .cw-workspace {
    padding:24px 14px 34px
  }
  .cw-header {
    margin-bottom:24px
  }
  .cw-header h1 {
    font-size:28px;
    letter-spacing:-.8px
  }
  .cw-kicker {
    font-size:9px;
    letter-spacing:1.3px
  }
  .cw-subtitle {
    font-size:13px
  }
  .cw-header-actions {
    width:100%
  }
  .cw-header-actions>.cw-button {
    flex:1;
    padding:10px
  }
  .cw-metrics {
    gap:10px;
    margin-bottom:18px
  }
  .cw-metric {
    padding:15px 13px;
    min-height:135px
  }
  .cw-metric>span {
    font-size:11px
  }
  .cw-metric small {
    font-size:10px
  }
  .cw-visit {
    grid-template-columns:36px minmax(0,1fr);
    padding:20px 0;
    gap:5px 12px
  }
  .cw-visit-icon {
    width:36px;
    height:40px;
    font-size:11px;
    border-radius:12px;
    grid-row:1/3
  }
  .cw-visit-person {
    grid-column:2;
    grid-row:1
  }
  .cw-visit-date {
    grid-column:2;
    grid-row:2;
    margin:7px 0
  }
  .cw-visit-progress {
    grid-column:2;
    grid-row:3
  }
  .cw-visit-progress small {
    font-size:11px
  }
  .cw-visit-person strong {
    font-size:15px
  }
  .cw-filter-row {
    gap:10px
  }
  .cw-field input,.cw-field select,.cw-field textarea {
    font-size:16px!important
  }
  .cw-filter-row select {
    font-size:13px!important;
    padding:10px 8px
  }
  .cw-list-heading {
    gap:10px
  }
  .cw-list-heading h2 {
    font-size:18px
  }
  .cw-list-heading .cw-button {
    padding:8px 10px;
    font-size:11px!important
  }
  .cw-panel {
    border-radius:17px
  }
  .cw-form-panel {
    padding:20px 16px
  }
  .cw-form-grid {
    grid-template-columns:1fr
  }
  .cw-form-footer {
    align-items:flex-start
  }
  .cw-form-footer>.cw-actions {
    justify-content:flex-end
  }
  .cw-form-footer .cw-button {
    font-size:12px!important;
    padding:9px 11px
  }
  .cw-section-heading h2 {
    font-size:21px
  }
  .cw-case-visits .cw-field {
    min-width:0
  }
  .cw-timeline .cw-between {
    align-items:flex-start;
    flex-direction:column;
    gap:2px
  }
  .cw-repeat-item {
    padding:14px
  }
  .cw-topic {
    font-size:11px
  }
  .cw-modal {
    padding:20px 16px;
    border-radius:18px;
    max-height:calc(100dvh - 24px)
  }
  .cw-modal-head h2 {
    font-size:20px
  }
  .cw-modal .cw-actions {
    flex-direction:column-reverse;
    align-items:stretch
  }
  .cw-check {
    font-size:12px
  }
  .cw-section-nav button {
    min-width:120px
  }
  .cw-signature canvas {
    aspect-ratio:2.7
  }
}
@media(prefers-reduced-motion:reduce) {
  .cw-root * {
    animation:none!important;
    transition:none!important
  }
}
@media print {
  body * {
    visibility:hidden!important
  }
  .cw-modal[open],.cw-modal[open] * {
    visibility:visible!important
  }
  .cw-modal[open] {
    position:absolute;
    inset:0;
    width:100%;
    max-width:none;
    height:auto;
    max-height:none;
    overflow:visible;
    box-shadow:none;
    border:0;
    background:white;
    padding:0
  }
  .cw-modal[open] button,.cw-modal-head {
    display:none!important
  }
  .cw-modal::backdrop {
    display:none
  }
  .cw-document {
    font-size:10pt;
    color:black
  }
  .cw-document section,.cw-signature-image {
    break-inside:avoid
  }
  .cw-form-grid {
    grid-template-columns:1fr 1fr
  }
  .cw-root,.cw-workspace {
    overflow:visible;
    height:auto
  }
}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale, 1))');
