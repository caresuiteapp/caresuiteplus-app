import { SYSTEM_BLUE_GRADIENT, SYSTEM_LIQUID_COLORS, systemLiquidGlass } from '../../design/tokens/systemLiquidGlass';

/** Web-only additions, using the current HealthOS palette. */
export const consultationEnhancements = String.raw`
.cw-root {
  --cw-accent:${SYSTEM_LIQUID_COLORS.electricBlue};
  --cw-glass:${systemLiquidGlass.panel};
  --cw-depth:${systemLiquidGlass.shadowSoft};
  --cw-brand-gradient:linear-gradient(125deg,${SYSTEM_BLUE_GRADIENT.join(',')});
  background:radial-gradient(ellipse at 0% 0%,rgba(22,131,255,.12),transparent 46%),radial-gradient(ellipse at 100% 38%,rgba(22,131,255,.08),transparent 42%),${systemLiquidGlass.pageDeep};
}
.cw-workspace { padding-top:24px; }
.cw-header {
  position:relative;
  isolation:isolate;
  overflow:hidden;
  padding:28px 30px;
  border-radius:24px;
  color:${SYSTEM_LIQUID_COLORS.white};
  background:radial-gradient(ellipse at 92% -20%,rgba(22,131,255,.74),transparent 62%),linear-gradient(120deg,${SYSTEM_LIQUID_COLORS.navy},#0a2a52);
  border:1px solid rgba(22,131,255,.3);
  box-shadow:0 16px 40px rgba(3,17,39,.13),inset 0 1px 0 rgba(255,255,255,.18);
  margin-bottom:22px;
  animation:cw-arrive .35s ease-out both;
}
.cw-header::before,.cw-header::after {
  content:'';position:absolute;z-index:-1;pointer-events:none;
  width:270px;height:270px;border-radius:50%;right:5%;top:-150px;
  border:1px solid rgba(255,255,255,.16);box-shadow:0 0 0 32px rgba(255,255,255,.025),0 0 0 72px rgba(255,255,255,.02);
}
.cw-header::after { width:170px;height:170px;right:30%;top:65px;opacity:.4; }
.cw-header>div { min-width:0; }
.cw-header .cw-kicker,.cw-header .cw-kicker span,.cw-header .cw-subtitle { color:${SYSTEM_LIQUID_COLORS.white}; }
.cw-header .cw-kicker { opacity:.85; }
.cw-header h1 { font-size:clamp(25px,2.7vw,34px); }
.cw-header-actions { max-width:360px; flex-shrink:1; }
.cw-header .cw-button { color:white;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.28);backdrop-filter:blur(12px); }
.cw-header .cw-button:hover:not(:disabled) { background:rgba(255,255,255,.2); }
.cw-header .cw-primary,.cw-primary { background:var(--cw-brand-gradient);color:white;border-color:transparent; }
.cw-primary:hover:not(:disabled) { background:linear-gradient(125deg,#0560d0,#1476e4); }
.cw-button { transition:transform .18s ease,box-shadow .18s ease,background .18s ease; }
.cw-button:hover:not(:disabled) { transform:translateY(-1px); }
.cw-button:active:not(:disabled) { transform:translateY(0); }
.cw-panel,.cw-metric { background:var(--cw-glass);box-shadow:var(--cw-depth);border-color:rgba(255,255,255,.88); }
.cw-metrics { gap:14px;margin-bottom:18px; }
.cw-metric { min-height:122px;padding:16px 19px;border-radius:18px; }
.cw-metric strong { font-size:30px;margin:3px 0 5px;line-height:1.2;font-variant-numeric:tabular-nums; }
.cw-metric:hover { transform:translateY(-3px);box-shadow:0 12px 28px rgba(22,65,116,.12); }
.cw-metric::after { width:75px;height:75px;top:-10px;right:-14px;opacity:.1; }
.cw-metric>span:first-child { padding-right:32px; }
.cw-metric .cw-metric-icon { position:absolute;right:16px;top:17px;color:var(--metric-color);line-height:0; }
.cw-workspace-intro { display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 21px;margin-bottom:20px;border:1px solid rgba(22,131,255,.18);border-radius:18px;background:linear-gradient(110deg,rgba(22,131,255,.07),rgba(255,255,255,.7)); }
.cw-workspace-intro strong { display:block;font-size:15px; }
.cw-workspace-intro p { font-size:12px;color:var(--cw-muted);margin:4px 0 0; }
.cw-workspace-intro .cw-kicker { display:block;margin-bottom:4px!important; }
.cw-workspace-intro .cw-button { flex-shrink:0; }
.cw-list-panel { padding:22px 24px 8px; }
.cw-list-meta { align-items:center;min-height:42px;padding-bottom:5px; }
.cw-list-meta .cw-link { min-height:30px; }
.cw-visit { transition:background .18s,box-shadow .18s; padding:19px 8px; }
.cw-visit:hover { background:rgba(22,131,255,.055);box-shadow:inset 3px 0 0 var(--cw-accent); }
.cw-visit-arrow { transition:transform .18s; }
.cw-visit:hover .cw-visit-arrow { transform:translate(2px,-2px); }
.cw-visit-icon { box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 4px 10px rgba(22,131,255,.1); }
.cw-filter-chips { display:flex;gap:7px;flex-wrap:wrap;margin:0 0 18px; }
.cw-choice { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;max-width:100%;padding:7px 11px;border:1px solid var(--cw-border);border-radius:10px;background:rgba(255,255,255,.74);color:var(--cw-ink);font-size:12px!important;line-height:1.45;text-align:left;white-space:normal;overflow-wrap:anywhere;transition:border-color .15s,background .15s,box-shadow .15s; }
.cw-choice:hover:not(:disabled) { border-color:rgba(22,131,255,.5);background:rgba(22,131,255,.065); }
.cw-choice[aria-pressed=true] { background:var(--cw-brand-gradient);border-color:transparent;color:white;box-shadow:0 4px 12px rgba(22,131,255,.18); }
.cw-choice>span { padding:1px 6px;border-radius:6px;background:rgba(22,131,255,.09);font-size:10px; }
.cw-choice[aria-pressed=true]>span { background:rgba(255,255,255,.2); }
.cw-advanced-filters,.cw-evidence-builder { padding:12px 0;border-top:1px solid var(--cw-border);margin-bottom:14px; }
.cw-advanced-filters>summary,.cw-evidence-builder>summary { cursor:pointer;min-height:28px;font-size:12px;font-weight:600;color:#075ebc; }
.cw-filter-details { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px;margin-top:12px; }
.cw-quick-choices { margin:0 0 20px; }
.cw-choice-label { display:block;color:var(--cw-muted);font-size:11px;margin-bottom:7px; }
.cw-quick-choices>div { display:flex;flex-wrap:wrap;gap:6px; }
.cw-quick-choices .cw-choice { min-height:32px;font-size:11px!important;padding:6px 9px; }
.cw-template-picker { padding:16px;border:1px solid rgba(22,131,255,.2);border-radius:14px;background:linear-gradient(135deg,rgba(22,131,255,.045),rgba(255,255,255,.8));margin:0 0 22px; }
.cw-template-picker>.cw-field { margin-bottom:0; }
.cw-template-picker>.cw-button { margin-top:12px; }
.cw-template-preview { padding:18px;background:rgba(22,131,255,.045);border:1px solid rgba(22,131,255,.17);border-radius:13px;margin-top:16px; }
.cw-template-preview h3 { margin:0 0 12px; }
.cw-template-preview p,.cw-template-preview li { font-size:13px;line-height:1.65; }
.cw-template-preview ul { padding-left:20px; }
.cw-template-preview>p:last-child { margin-bottom:0; }
.cw-template-preview .cw-muted { margin-top:12px; }
.cw-template-cards { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px; }
.cw-template-card { display:flex;flex-direction:column;align-items:flex-start;gap:11px;min-width:0;text-align:left;padding:18px;border:1px solid var(--cw-border);border-radius:16px;background:rgba(255,255,255,.74);color:var(--cw-ink);transition:background .18s,box-shadow .18s,border-color .18s; }
.cw-template-card>strong { font-size:15px;line-height:1.35; }
.cw-template-card>span:not(.cw-tag) { font-size:12px;color:var(--cw-muted); }
.cw-template-card small { width:100%;display:flex;justify-content:space-between;font-size:10px;color:var(--cw-muted);margin-top:auto; }
.cw-template-card:hover,.cw-template-card[aria-pressed=true] { border-color:var(--cw-accent);background:rgba(22,131,255,.05);box-shadow:0 4px 14px rgba(22,131,255,.08); }
.cw-template-card[aria-pressed=true] { box-shadow:inset 0 0 0 1px var(--cw-accent); }
.cw-template-note { margin:20px 0 0;font-size:12px;color:var(--cw-muted); }
.cw-workflow-hint { display:flex;gap:13px;align-items:flex-start;padding:16px 18px;border-radius:15px;border:1px solid rgba(22,131,255,.2);background:rgba(22,131,255,.055); }
.cw-workflow-hint strong { font-size:13px; }
.cw-workflow-hint p { margin:4px 0 0;font-size:12px;color:var(--cw-muted); }
.cw-completion { display:block;appearance:none;width:100%;height:6px;border:0;border-radius:6px;overflow:hidden;background:rgba(22,131,255,.12);margin:12px 0; }
.cw-completion::-webkit-progress-bar { background:rgba(22,131,255,.12); }
.cw-completion::-webkit-progress-value { background:var(--cw-brand-gradient);border-radius:6px; }
.cw-completion::-moz-progress-bar { background:var(--cw-brand-gradient);border-radius:6px; }
.cw-section-nav button { transition:background .18s,box-shadow .18s; }
.cw-section-nav button[aria-current=step] { background:rgba(22,131,255,.09);border-color:rgba(22,131,255,.3);box-shadow:0 3px 12px rgba(22,131,255,.06); }
.cw-section-nav button[aria-current=step] .cw-step { background:var(--cw-brand-gradient); }
.cw-topic-fieldset { border:0;padding:0;margin:8px 0 22px;min-width:0; }
.cw-topic-fieldset legend { font-size:12px;font-weight:600;margin-bottom:8px; }
.cw-topic-fieldset p { margin-bottom:10px; }
.cw-topic { transition:background .15s,border-color .15s; }
.cw-topic:has(input:checked) { border-color:rgba(22,131,255,.5);background:rgba(22,131,255,.09); }
.cw-topic input,.cw-check input { accent-color:var(--cw-accent); }
.cw-repeat-item { background:linear-gradient(135deg,rgba(22,131,255,.035),rgba(255,255,255,.65)); }
.cw-field input:focus,.cw-field textarea:focus,.cw-field select:focus { border-color:var(--cw-accent);box-shadow:0 0 0 3px rgba(22,131,255,.08); }
.cw-modal { background:linear-gradient(145deg,rgba(247,251,255,.98),rgba(255,255,255,.97));backdrop-filter:blur(28px);animation:cw-arrive .22s ease-out; }
.cw-evidence-builder[open]>summary { margin-bottom:12px; }
.cw-followups { margin-bottom:20px; }
.cw-task-list { display:grid;gap:10px;margin-bottom:14px; }
.cw-task-card { display:grid;grid-template-columns:minmax(96px,.6fr) minmax(0,3fr) minmax(140px,1fr);gap:18px;align-items:start;padding:18px;border-radius:15px;border:1px solid rgba(22,131,255,.18);background:linear-gradient(115deg,rgba(22,131,255,.045),rgba(255,255,255,.85));transition:box-shadow .18s,border-color .18s; }
.cw-task-card:hover { border-color:rgba(22,131,255,.35);box-shadow:0 5px 16px rgba(22,65,116,.07); }
.cw-task-overdue { border-left:3px solid #9c5c10; }
.cw-task-date { display:flex;flex-direction:column;gap:5px;font-size:12px; }
.cw-task-date span { color:var(--cw-muted); }
.cw-task-overdue .cw-task-date span { color:#85500e;font-weight:600; }
.cw-task-content { min-width:0;overflow-wrap:anywhere; }
.cw-task-content h3 { font-size:14px;margin:0 0 6px;line-height:1.5; }
.cw-task-content p { margin:5px 0;font-size:12px; }
.cw-task-content small { color:var(--cw-muted);font-size:10px; }
.cw-task-outcome { border-left:2px solid rgba(22,131,255,.25);padding:7px 10px;background:rgba(255,255,255,.5);border-radius:0 8px 8px 0; }
.cw-task-actions { display:flex;flex-direction:column;align-items:stretch;gap:7px; }
.cw-preserve-lines { white-space:pre-wrap;overflow-wrap:anywhere; }
.cw-template-history { margin-top:18px;border-top:1px solid var(--cw-border);padding-top:14px; }
.cw-template-history summary { cursor:pointer;font-size:12px;font-weight:600;min-height:32px; }
.cw-template-history article { border-left:2px solid rgba(22,131,255,.25);padding:10px 16px;margin-top:8px; }
.cw-template-history p { font-size:12px;overflow-wrap:anywhere; }
.cw-template-actions { margin-top:14px; }
.cw-template-card { overflow-wrap:anywhere; }
@container (max-width:800px) { .cw-task-card { grid-template-columns:minmax(88px,.5fr) minmax(0,2fr); } .cw-task-actions { grid-column:2;flex-direction:row;flex-wrap:wrap; } }
@container (max-width:480px) { .cw-task-card { grid-template-columns:minmax(0,1fr);gap:10px;padding:14px; } .cw-task-date { flex-direction:row;justify-content:space-between;flex-wrap:wrap; } .cw-task-actions { grid-column:1;flex-direction:column; } }
@keyframes cw-arrive { from { opacity:0;transform:translateY(6px); } to { opacity:1;transform:translateY(0); } }
@container (max-width:800px) {
 .cw-header { padding:24px; }
 .cw-workspace-intro { align-items:flex-start;flex-direction:column;gap:12px; }
 .cw-metric { min-height:118px; }
 .cw-header-actions { max-width:none; }
 .cw-filter-details { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@container (max-width:480px) {
 .cw-workspace { padding:16px 12px 30px; }
 .cw-header { padding:22px 18px;border-radius:19px; }
 .cw-header h1 { font-size:26px; }
 .cw-header .cw-kicker { font-size:9px;letter-spacing:1px; }
 .cw-header-actions { gap:7px; }
 .cw-metric { min-height:112px;padding:14px 12px; }
 .cw-metric strong { font-size:27px; }
 .cw-metric small { line-height:1.5; }
 .cw-workspace-intro { padding:16px; }
 .cw-workspace-intro .cw-button { width:100%; }
 .cw-filter-details { grid-template-columns:1fr; }
 .cw-template-picker,.cw-template-preview { padding:13px; }
 .cw-list-panel { padding:18px 14px 6px; }
 .cw-template-cards { grid-template-columns:1fr; }
 .cw-choice { min-height:40px; }
 .cw-quick-choices .cw-choice { min-height:36px; }
}
@media (prefers-reduced-motion:reduce) { .cw-root * { animation:none!important;transition:none!important; } }
@media print { .cw-header,.cw-workspace-intro,.cw-workflow-hint { display:none!important; } .cw-modal[open] { background:white;backdrop-filter:none;animation:none; } }
`;
