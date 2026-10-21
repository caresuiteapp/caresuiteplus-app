import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { careSuiteColors } from '@/design/tokens/colors';
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

/** Scoped Web styles. The workspace responds to its own available width. */
export const academyStyles = `
.academy-workspace {
  --ac-ink: ${systemLiquidGlass.text.primary};
  --ac-secondary: color-mix(in srgb, ${SYSTEM_LIQUID_COLORS.navy} 76%, transparent);
  --ac-muted: color-mix(in srgb, ${SYSTEM_LIQUID_COLORS.navy} 64%, transparent);
  --ac-blue: ${SYSTEM_LIQUID_COLORS.electricBlue};
  --ac-on-accent: ${systemLiquidGlass.text.onAccent};
  --ac-navy: ${SYSTEM_LIQUID_COLORS.navy};
  --ac-glass: ${careSuiteAuroraTheme.glass.background};
  --ac-glass-strong: ${careSuiteAuroraTheme.glass.backgroundStrong};
  --ac-line: ${careSuiteAuroraTheme.glass.border};
  --ac-line-strong: ${careSuiteAuroraTheme.glass.borderStrong};
  --ac-input: ${systemLiquidGlass.input};
  --ac-hover: ${systemLiquidGlass.rowHover};
  --ac-selected: ${systemLiquidGlass.rowSelected};
  --ac-danger: ${careSuiteColors.light.status.danger};
  --ac-attention: ${careSuiteColors.light.status.warning};
  --ac-good: ${careSuiteColors.light.status.success};
  --ac-primary-gradient: linear-gradient(120deg, ${careSuiteAuroraTheme.gradients.buttonPrimary.join(', ')});
  box-sizing: border-box;
  container: academy / inline-size;
  isolation: isolate;
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  flex: 1;
  padding: clamp(14px, 2.2vw, 28px);
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--ac-ink);
  background: radial-gradient(ellipse at 88% 0%, ${systemLiquidGlass.glow.soft}, transparent 48%), ${systemLiquidGlass.pageDeep};
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  scrollbar-color: var(--ac-line-strong) transparent;
  -webkit-font-smoothing: antialiased;
}
.academy-workspace *, .academy-workspace *::before, .academy-workspace *::after { box-sizing: border-box; }
.academy-workspace h1, .academy-workspace h2, .academy-workspace h3,
.academy-workspace h4, .academy-workspace p { margin: 0; overflow-wrap: anywhere; }
.academy-workspace h1 { font-size: clamp(24px, 3.4cqi, 36px); font-weight: 760; line-height: 1.12; letter-spacing: -.035em; }
.academy-workspace h2, .academy-workspace .ac-section-title { font-size: 20px; font-weight: 730; line-height: 1.3; letter-spacing: -.025em; }
.academy-workspace h3 { font-size: 17px; font-weight: 700; line-height: 1.35; letter-spacing: -.015em; }
.academy-workspace h4 { font-size: 15px; font-weight: 700; }
.academy-workspace button, .academy-workspace input, .academy-workspace select, .academy-workspace textarea { font: inherit; }
.academy-workspace button { touch-action: manipulation; }
.academy-workspace button, .academy-workspace a { -webkit-tap-highlight-color: transparent; }
.academy-workspace button:focus-visible, .academy-workspace a:focus-visible,
.academy-workspace input:focus-visible, .academy-workspace select:focus-visible, .academy-workspace textarea:focus-visible,
.academy-workspace summary:focus-visible {
  outline: 3px solid var(--ac-blue);
  outline-offset: 3px;
}
.academy-workspace fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.academy-workspace fieldset:disabled { min-width: 0; }
.academy-workspace legend { padding: 0; margin: 0 0 12px; font-size: 15px; font-weight: 700; }
.academy-workspace a { color: color-mix(in srgb, var(--ac-blue) 72%, var(--ac-navy)); text-underline-offset: 3px; }
.academy-workspace hr { width: 100%; border: 0; border-top: 1px solid var(--ac-line); margin: 20px 0; }
.academy-workspace .ac-header {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  min-width: 0; padding: 24px 26px; margin-bottom: 18px; border-radius: 26px;
  color: var(--ac-on-accent); border: 1px solid var(--ac-line-strong);
  background: radial-gradient(ellipse at 95% 5%, ${systemLiquidGlass.glow.strong}, transparent 58%), linear-gradient(118deg, ${careSuiteAuroraTheme.gradients.heroAurora.join(', ')});
  box-shadow: ${systemLiquidGlass.shadowSoft}, ${systemLiquidGlass.shadowInset};
}
.academy-workspace .ac-header-copy { display: grid; gap: 7px; min-width: 0; flex: 1 1 280px; }
.academy-workspace .ac-header-copy p { max-width: 68ch; color: color-mix(in srgb, var(--ac-on-accent) 83%, transparent); }
.academy-workspace .ac-eyebrow { font-size: 11px; font-weight: 750; letter-spacing: .12em; line-height: 1.4; text-transform: uppercase; }
.academy-workspace .ac-header .ac-eyebrow { color: color-mix(in srgb, var(--ac-on-accent) 76%, transparent); }
.academy-workspace .ac-brand-mark {
  display: grid; place-items: center; flex: 0 0 52px; width: 52px; height: 52px;
  border-radius: 18px; font-size: 24px; font-weight: 720;
  border: 1px solid color-mix(in srgb, var(--ac-on-accent) 27%, transparent);
  background: color-mix(in srgb, var(--ac-on-accent) 9%, transparent);
  box-shadow: ${systemLiquidGlass.shadowInset};
}
.academy-workspace .ac-brand-mark svg { display: block; width: 28px; height: 28px; }
.academy-workspace .ac-header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
.academy-workspace .ac-header .ac-button:not(.primary):not(.danger) {
  color: var(--ac-on-accent); border-color: color-mix(in srgb, var(--ac-on-accent) 28%, transparent);
  background: color-mix(in srgb, var(--ac-on-accent) 9%, transparent);
}
.academy-workspace .ac-tabs {
  display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 0 0 20px; padding: 6px;
  border: 1px solid var(--ac-line); border-radius: 18px; background: var(--ac-glass);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
}
.academy-workspace .ac-tab {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 15px;
  min-height: 42px; min-width: 0; border: 1px solid transparent; border-radius: 12px;
  font-weight: 650; color: var(--ac-secondary); background: transparent; cursor: pointer;
  white-space: normal; text-align: center; overflow-wrap: anywhere; transition: background .16s ease, color .16s ease;
}
.academy-workspace .ac-tab[aria-current="page"] { color: var(--ac-on-accent); background: var(--ac-primary-gradient); box-shadow: 0 4px 12px ${systemLiquidGlass.glow.soft}; }
.academy-workspace .ac-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-width: 0; min-height: 42px; max-width: 100%; padding: 10px 16px;
  border: 1px solid var(--ac-line-strong); border-radius: 12px;
  background: var(--ac-glass-strong); color: var(--ac-ink); font-weight: 650; line-height: 1.35;
  cursor: pointer; text-decoration: none; text-align: center; white-space: normal; overflow-wrap: anywhere;
  transition: background .16s ease, box-shadow .16s ease, transform .16s ease;
}
.academy-workspace .ac-button.primary { border-color: transparent; color: var(--ac-on-accent); background: var(--ac-primary-gradient); box-shadow: 0 5px 15px ${systemLiquidGlass.glow.soft}; }
.academy-workspace .ac-button.subtle { border-color: transparent; background: transparent; color: var(--ac-secondary); }
.academy-workspace .ac-button.danger { color: color-mix(in srgb, var(--ac-danger) 55%, var(--ac-ink)); border-color: color-mix(in srgb, var(--ac-danger) 42%, transparent); background: color-mix(in srgb, var(--ac-danger) 7%, var(--ac-glass-strong)); }
.academy-workspace .ac-button.small { min-height: 34px; padding: 7px 11px; font-size: 12px; border-radius: 10px; }
.academy-workspace .ac-button:disabled, .academy-workspace .ac-tab:disabled, .academy-workspace fieldset:disabled .ac-button {
  cursor: not-allowed; opacity: .5; box-shadow: none; transform: none;
}
.academy-workspace .ac-panel {
  min-width: 0; margin-bottom: 18px; padding: 22px;
  border: 1px solid var(--ac-line); border-radius: 22px; background: var(--ac-glass);
  box-shadow: ${systemLiquidGlass.shadowSoft}, ${systemLiquidGlass.shadowInset};
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
}
.academy-workspace .ac-panel:last-child { margin-bottom: 0; }
.academy-workspace .ac-panel > .ac-section-title + p { margin-top: 8px; }
.academy-workspace .ac-panel > p + p, .academy-workspace .ac-panel > p + .ac-field,
.academy-workspace .ac-panel > .ac-field + .ac-card-actions,
.academy-workspace .ac-panel > p + .ac-card-actions,
.academy-workspace .ac-panel > .ac-empty + .ac-button { margin-top: 14px; }
.academy-workspace .ac-panel > fieldset:not(.ac-review-form) { display: grid; gap: 14px; }
.academy-workspace .ac-panel-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; }
.academy-workspace .ac-panel-header > div:first-child { flex: 1 1 220px; min-width: 0; display: grid; gap: 5px; }
.academy-workspace .ac-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; align-items: stretch; }
.academy-workspace .ac-course-card {
  display: flex; flex-direction: column; gap: 14px; min-width: 0; padding: 17px;
  border: 1px solid var(--ac-line); border-radius: 20px; background: var(--ac-glass-strong);
  box-shadow: 0 7px 20px color-mix(in srgb, var(--ac-navy) 5%, transparent);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.academy-workspace .ac-course-cover {
  position: relative; isolation: isolate; display: flex; flex-direction: column; justify-content: space-between; gap: 20px;
  min-height: 105px; padding: 16px; overflow: hidden; border-radius: 15px;
  color: var(--ac-on-accent); background: linear-gradient(130deg, ${careSuiteAuroraTheme.gradients.heroAurora.join(', ')});
}
.academy-workspace .ac-course-cover::before {
  position: absolute; z-index: -1; content: ''; width: 160px; height: 160px; right: -34px; top: -48px;
  border: 1px solid color-mix(in srgb, var(--ac-on-accent) 22%, transparent); border-radius: 50%;
  box-shadow: 0 0 0 28px color-mix(in srgb, var(--ac-on-accent) 5%, transparent), 0 0 0 56px color-mix(in srgb, var(--ac-on-accent) 3%, transparent);
}
.academy-workspace .ac-course-cover[data-tone="1"] { background: linear-gradient(125deg, ${careSuiteAuroraTheme.gradients.buttonPrimary.join(', ')}); }
.academy-workspace .ac-course-cover[data-tone="2"] { background: linear-gradient(150deg, var(--ac-blue), var(--ac-navy)); }
.academy-workspace .ac-course-cover[data-tone="3"] { background: radial-gradient(circle at 80% 30%, var(--ac-blue), var(--ac-navy) 75%); }
.academy-workspace .ac-course-title { font-size: 18px; font-weight: 720; line-height: 1.35; letter-spacing: -.02em; overflow-wrap: anywhere; }
.academy-workspace .ac-course-meta { display: flex; flex-direction: column; align-items: stretch; flex: 1; gap: 12px; min-width: 0; color: var(--ac-secondary); font-size: 14px; }
.academy-workspace .ac-course-meta > .ac-button { margin-top: auto; }
.academy-workspace .ac-course-meta > .ac-progress { margin-top: -6px; }
.academy-workspace .ac-course-cover > span:last-child { color: color-mix(in srgb, var(--ac-on-accent) 87%, transparent); font-size: 12px; }
.academy-workspace .ac-card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: auto; padding-top: 4px; }
.academy-workspace .ac-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.academy-workspace .ac-status {
  display: inline-flex; align-items: center; gap: 5px; max-width: 100%; border: 1px solid var(--ac-line);
  padding: 4px 9px; border-radius: 8px; background: var(--ac-hover); color: var(--ac-secondary);
  font-size: 11px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere;
}
.academy-workspace .ac-status[data-tone="good"] { background: color-mix(in srgb, var(--ac-good) 11%, var(--ac-glass-strong)); border-color: color-mix(in srgb, var(--ac-good) 28%, transparent); color: color-mix(in srgb, var(--ac-good) 34%, var(--ac-ink)); }
.academy-workspace .ac-status[data-tone="attention"] { background: color-mix(in srgb, var(--ac-attention) 13%, var(--ac-glass-strong)); border-color: color-mix(in srgb, var(--ac-attention) 40%, transparent); color: color-mix(in srgb, var(--ac-attention) 29%, var(--ac-ink)); }
.academy-workspace .ac-status[data-tone="danger"] { background: color-mix(in srgb, var(--ac-danger) 8%, var(--ac-glass-strong)); border-color: color-mix(in srgb, var(--ac-danger) 30%, transparent); color: color-mix(in srgb, var(--ac-danger) 52%, var(--ac-ink)); }
.academy-workspace .ac-muted { color: var(--ac-muted); font-size: 13px; line-height: 1.55; }
.academy-workspace .ac-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 155px), 1fr)); gap: 12px; margin-bottom: 20px; }
.academy-workspace .ac-kpi { display: grid; align-content: start; gap: 5px; min-width: 0; padding: 18px 20px; border-radius: 19px; border: 1px solid var(--ac-line); background: var(--ac-glass); }
.academy-workspace .ac-kpi-value { color: var(--ac-navy); font-size: 30px; font-weight: 750; line-height: 1.1; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.academy-workspace .ac-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 20px; }
.academy-workspace .ac-search { flex: 1 1 260px; min-width: 0; }
.academy-workspace .ac-toolbar > .ac-field { flex: 1 1 165px; }
.academy-workspace .ac-field { display: grid; align-content: start; gap: 6px; min-width: 0; color: var(--ac-secondary); font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
.academy-workspace .ac-field > span:first-child, .academy-workspace .ac-field > label:first-child { font-size: 12px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; }
.academy-workspace .ac-field > small, .academy-workspace .ac-field > .ac-muted { font-weight: 400; }
.academy-workspace .ac-input, .academy-workspace .ac-textarea,
.academy-workspace .ac-field input:not([type="checkbox"]):not([type="radio"]), .academy-workspace .ac-field select, .academy-workspace .ac-field textarea {
  display: block; width: 100%; min-width: 0; max-width: 100%; min-height: 44px; padding: 10px 12px;
  border: 1px solid var(--ac-line-strong); border-radius: 11px;
  background: var(--ac-input); color: var(--ac-ink); font-size: 14px; font-weight: 400; line-height: 1.5;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--ac-navy) 3%, transparent);
}
.academy-workspace .ac-input::placeholder, .academy-workspace .ac-textarea::placeholder, .academy-workspace textarea::placeholder { color: var(--ac-muted); opacity: .9; }
.academy-workspace .ac-textarea, .academy-workspace .ac-field textarea { min-height: 110px; resize: vertical; }
.academy-workspace input:disabled, .academy-workspace select:disabled, .academy-workspace textarea:disabled { cursor: not-allowed; color: var(--ac-muted); background: var(--ac-hover); }
.academy-workspace .ac-inline-fields { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
.academy-workspace .ac-inline-fields > * { min-width: 0; flex: 1 1 140px; }
.academy-workspace .ac-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.academy-workspace .ac-span-all { grid-column: 1 / -1; }
.academy-workspace .ac-empty { display: grid; justify-items: center; gap: 9px; padding: 38px 22px; border: 1px dashed var(--ac-line-strong); border-radius: 19px; background: var(--ac-hover); text-align: center; }
.academy-workspace .ac-empty p { max-width: 52ch; color: var(--ac-muted); }
.academy-workspace .ac-message { display: grid; gap: 6px; margin: 12px 0 18px; padding: 13px 16px; border: 1px solid var(--ac-line-strong); border-left-width: 3px; border-radius: 12px; background: var(--ac-selected); color: var(--ac-secondary); overflow-wrap: anywhere; }
.academy-workspace .ac-message[data-tone="error"] { border-color: color-mix(in srgb, var(--ac-danger) 50%, transparent); background: color-mix(in srgb, var(--ac-danger) 7%, var(--ac-glass-strong)); color: color-mix(in srgb, var(--ac-danger) 48%, var(--ac-ink)); }
.academy-workspace .ac-message[data-tone="success"] { border-color: color-mix(in srgb, var(--ac-good) 40%, transparent); background: color-mix(in srgb, var(--ac-good) 7%, var(--ac-glass-strong)); }
.academy-workspace .ac-message .ac-button { justify-self: start; }
.academy-workspace .ac-skeleton { min-height: 110px; border-radius: 18px; background: linear-gradient(100deg, var(--ac-hover), var(--ac-glass-strong), var(--ac-hover)); background-size: 220% 100%; animation: ac-loading 1.8s ease-in-out infinite; }
.academy-workspace .ac-list { display: grid; gap: 10px; min-width: 0; margin: 0; padding: 0; list-style: none; }
.academy-workspace .ac-panel > .ac-badges + .ac-list { margin-top: 16px; }
.academy-workspace .ac-panel > .ac-list + .ac-card-actions { margin-top: 14px; }
.academy-workspace .ac-list-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 15px 16px; border: 1px solid var(--ac-line); border-radius: 15px; background: var(--ac-glass-strong); }
.academy-workspace .ac-list-main { display: grid; gap: 5px; flex: 1 1 240px; min-width: 0; overflow-wrap: anywhere; }
.academy-workspace .ac-list-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.academy-workspace .ac-progress { width: 100%; height: 6px; margin: 8px 0 4px; border-radius: 99px; overflow: hidden; background: var(--ac-line); }
.academy-workspace .ac-progress > span { display: block; height: 100%; max-width: 100%; border-radius: inherit; background: var(--ac-primary-gradient); transition: width .24s ease; }
.academy-workspace .ac-detail-grid { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr); align-items: start; gap: 20px; }
.academy-workspace .ac-detail-main, .academy-workspace .ac-detail-aside { display: grid; align-content: start; gap: 16px; min-width: 0; }
.academy-workspace .ac-detail-aside { padding: 18px; border: 1px solid var(--ac-line); border-radius: 17px; background: var(--ac-hover); }
.academy-workspace .ac-targets { display: grid; gap: 7px; max-height: 330px; overflow: auto; padding: 3px; scrollbar-gutter: stable; }
.academy-workspace .ac-target-row { display: flex; align-items: flex-start; gap: 11px; padding: 11px 12px; border: 1px solid var(--ac-line); border-radius: 12px; background: var(--ac-glass-strong); cursor: pointer; }
.academy-workspace .ac-target-row:has(input:checked) { border-color: var(--ac-line-strong); background: var(--ac-selected); }
.academy-workspace .ac-target-row:has(input:disabled) { cursor: not-allowed; }
.academy-workspace .ac-target-row > div, .academy-workspace .ac-target-row > span { min-width: 0; display: grid; gap: 3px; overflow-wrap: anywhere; }
.academy-workspace .ac-target-row small { color: var(--ac-muted); font-size: 12px; }
.academy-workspace .ac-checkbox-label { display: flex; align-items: flex-start; gap: 9px; min-width: 0; line-height: 1.5; color: var(--ac-secondary); }
.academy-workspace input[type="checkbox"], .academy-workspace input[type="radio"] { width: 18px; height: 18px; min-width: 18px; margin: 2px 0 0; accent-color: var(--ac-blue); cursor: pointer; }
.academy-workspace input[type="checkbox"]:disabled, .academy-workspace input[type="radio"]:disabled { cursor: not-allowed; }
.academy-workspace .ac-template-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; }
.academy-workspace .ac-template-card { display: grid; align-content: start; gap: 8px; min-width: 0; padding: 18px; border: 1px solid var(--ac-line-strong); border-radius: 16px; text-align: left; color: var(--ac-ink); background: var(--ac-glass-strong); cursor: pointer; transition: border-color .16s ease, background .16s ease; }
.academy-workspace .ac-template-card:disabled { cursor: not-allowed; opacity: .5; }
.academy-workspace .ac-template-card span, .academy-workspace .ac-template-card small { color: var(--ac-muted); overflow-wrap: anywhere; }
.academy-workspace .ac-editor-grid { display: grid; grid-template-columns: minmax(210px, .75fr) minmax(0, 2fr); gap: 20px; align-items: start; }
.academy-workspace .ac-lesson-list { display: grid; align-content: start; gap: 8px; min-width: 0; padding: 4px; }
.academy-workspace .ac-lesson-nav { display: flex; align-items: flex-start; gap: 11px; width: 100%; min-width: 0; padding: 13px 12px; border: 1px solid var(--ac-line); border-radius: 13px; text-align: left; color: var(--ac-secondary); background: var(--ac-glass-strong); cursor: pointer; overflow-wrap: anywhere; }
.academy-workspace .ac-lesson-nav > :last-child { display: grid; gap: 3px; flex: 1; min-width: 0; }
.academy-workspace .ac-lesson-nav small { color: var(--ac-muted); font-size: 12px; }
.academy-workspace .ac-lesson-nav[aria-current="step"] { border-color: var(--ac-line-strong); background: var(--ac-selected); color: var(--ac-ink); box-shadow: inset 3px 0 0 var(--ac-blue); }
.academy-workspace .ac-lesson-nav:disabled { cursor: not-allowed; opacity: .6; }
.academy-workspace .ac-lesson-number { display: grid; place-items: center; flex: 0 0 28px; width: 28px; height: 28px; border-radius: 9px; color: var(--ac-on-accent); background: var(--ac-primary-gradient); font-size: 11px; font-weight: 750; font-variant-numeric: tabular-nums; }
.academy-workspace .ac-editor-content { display: grid; gap: 18px; min-width: 0; padding: 20px; border: 1px solid var(--ac-line); border-radius: 17px; background: var(--ac-glass-strong); }
.academy-workspace .ac-editor-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 14px 0; }
.academy-workspace .ac-editor-footer { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 9px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--ac-line); }
.academy-workspace .ac-editor-footer > div:first-child:not(.ac-card-actions) { display: grid; gap: 5px; min-width: 0; flex: 1 1 240px; }
.academy-workspace .ac-editor-footer > .ac-card-actions { margin-top: 0; padding-top: 0; }
.academy-workspace .ac-question { display: grid; gap: 12px; min-width: 0; padding: 17px; border: 1px solid var(--ac-line); border-radius: 14px; background: var(--ac-hover); }
.academy-workspace .ac-option { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; min-width: 0; }
.academy-workspace .ac-option > .ac-field, .academy-workspace .ac-option > .ac-input { flex: 1 1 160px; width: auto; }
.academy-workspace .ac-radio { display: inline-flex; align-items: center; gap: 7px; color: var(--ac-secondary); font-size: 12px; }
.academy-workspace .ac-learning-body { min-width: 0; color: var(--ac-secondary); line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.academy-workspace .ac-resource { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 18px; border: 1px solid var(--ac-line-strong); border-radius: 15px; background: var(--ac-selected); }
.academy-workspace .ac-resource > div { min-width: 0; flex: 1 1 200px; }
.academy-workspace .ac-resource > strong { flex: 1 1 100%; overflow-wrap: anywhere; }
.academy-workspace .ac-resource > p { flex: 1 1 220px; }
.academy-workspace .ac-quiz { display: grid; gap: 18px; min-width: 0; }
.academy-workspace .ac-quiz > fieldset { display: grid; gap: 16px; }
.academy-workspace .ac-quiz-option { display: flex; align-items: flex-start; gap: 10px; padding: 13px; border: 1px solid var(--ac-line); border-radius: 11px; color: var(--ac-secondary); background: var(--ac-glass-strong); cursor: pointer; overflow-wrap: anywhere; }
.academy-workspace .ac-quiz-option:has(input:checked) { border-color: var(--ac-line-strong); background: var(--ac-selected); }
.academy-workspace .ac-quiz-option:has(input:disabled) { cursor: not-allowed; }
.academy-workspace .ac-lesson-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--ac-line); }
.academy-workspace .ac-lesson-actions > .ac-checkbox-label { flex: 1 1 100%; }
.academy-workspace .ac-lesson-actions > p { flex: 1 1 220px; }
.academy-workspace .ac-review-form { display: grid; gap: 14px; min-width: 0; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--ac-line); }
.academy-workspace .ac-stat-line { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 7px 14px; padding: 9px 0; border-bottom: 1px solid var(--ac-line); }
.academy-workspace .ac-stat-line:last-child { border-bottom: 0; }
.academy-workspace .ac-stat-line > :first-child { color: var(--ac-muted); }
.academy-workspace .ac-stat-line > :last-child { font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
.academy-workspace .ac-card-grid > .ac-panel { display: flex; flex-direction: column; gap: 12px; margin-bottom: 0; }
.academy-workspace .ac-card-grid > .ac-panel > .ac-button { margin-top: auto; align-self: flex-start; }
.academy-workspace details { min-width: 0; }
.academy-workspace summary { width: fit-content; max-width: 100%; padding: 6px 0; color: var(--ac-secondary); font-weight: 650; cursor: pointer; overflow-wrap: anywhere; }
.academy-workspace details[open] > .ac-learning-body { margin-top: 10px; }
.academy-workspace .ac-template-library { display: grid; gap: 18px; min-width: 0; }
.academy-workspace .ac-template-library > .ac-panel { margin-bottom: 0; }
.academy-workspace .ac-template-intro { background: radial-gradient(ellipse at 100% 0%, ${systemLiquidGlass.glow.soft}, transparent 64%), var(--ac-glass-strong); }
.academy-workspace .ac-template-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 24px; padding-top: 16px; border-top: 1px solid var(--ac-line); color: var(--ac-secondary); }
.academy-workspace .ac-template-summary > span { min-width: 0; }
.academy-workspace .ac-template-summary > span:last-child { flex: 1 1 320px; font-size: 12px; color: var(--ac-muted); }
.academy-workspace .ac-template-summary strong { color: var(--ac-blue); font-size: 20px; margin-right: 5px; }
.academy-workspace .ac-template-filters { align-items: end; }
.academy-workspace .ac-template-filters > .ac-field { flex: 1 1 170px; min-width: 0; }
.academy-workspace .ac-template-filters > .ac-search { flex: 2 1 250px; }
.academy-workspace .ac-template-catalog { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 16px; margin-top: 16px; }
.academy-workspace .ac-template-tile { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border: 1px solid var(--ac-line); border-radius: 21px; background: var(--ac-glass-strong); box-shadow: ${systemLiquidGlass.shadowInset}; transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.academy-workspace .ac-template-tile[data-selected] { border-color: var(--ac-blue); box-shadow: ${systemLiquidGlass.shadowSoft}; }
.academy-workspace .ac-template-tile-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 9px; min-height: 70px; padding: 18px; border-bottom: 1px solid var(--ac-line); background: linear-gradient(120deg, var(--ac-selected), var(--ac-glass)); }
.academy-workspace .ac-template-tile-top[data-tone="1"], .academy-workspace .ac-template-tile-top[data-tone="3"] { background: radial-gradient(ellipse at 0% 0%, ${systemLiquidGlass.glow.soft}, transparent 90%), var(--ac-glass); }
.academy-workspace .ac-template-tile-top > .ac-eyebrow { color: var(--ac-blue); }
.academy-workspace .ac-template-tile-content { display: flex; flex-direction: column; align-items: stretch; gap: 10px; padding: 20px; min-width: 0; flex: 1; }
.academy-workspace .ac-template-tile-content > p { color: var(--ac-secondary); }
.academy-workspace .ac-template-tile-content > .ac-card-actions { margin-top: auto; padding-top: 8px; }
.academy-workspace .ac-template-tile-content .ac-button { flex: 1 1 120px; }
.academy-workspace .ac-template-detail > .ac-badges, .academy-workspace .ac-template-detail > p, .academy-workspace .ac-template-detail > .ac-card-actions { margin-top: 14px; }
.academy-workspace .ac-template-detail:focus-visible, .academy-workspace [aria-label="Vorlagenstatus ändern"]:focus-visible { outline: 3px solid var(--ac-blue); outline-offset: 3px; }
.academy-workspace .ac-template-outline { display: grid; gap: 0; list-style: none; padding: 0; margin: 20px 0; }
.academy-workspace .ac-template-outline > li { display: flex; align-items: flex-start; gap: 13px; padding: 15px 0; border-bottom: 1px solid var(--ac-line); min-width: 0; }
.academy-workspace .ac-template-outline > li > div { display: grid; gap: 4px; min-width: 0; flex: 1; }
.academy-workspace .ac-template-outline > li:last-child { border-bottom: 0; }
.academy-workspace .ac-template-outline .ac-learning-body { max-height: 340px; overflow: auto; padding: 14px; border-radius: 12px; background: var(--ac-input); }
.academy-workspace .ac-author-tools, .academy-workspace .ac-question-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.academy-workspace .ac-author-tools { margin: 16px 0; padding: 14px; border-radius: 15px; border: 1px solid var(--ac-line); background: var(--ac-glass); }
.academy-workspace .ac-readiness, .academy-workspace .ac-template-save-form, .academy-workspace .ac-lesson-presets { display: grid; gap: 14px; padding: 18px; margin: 16px 0; border-radius: 18px; border: 1px solid var(--ac-line-strong); background: var(--ac-glass-strong); }
.academy-workspace .ac-readiness ol { display: grid; gap: 7px; padding-left: 22px; margin: 0; }
.academy-workspace .ac-readiness li { padding-left: 4px; color: var(--ac-secondary); overflow-wrap: anywhere; }
.academy-workspace .ac-readiness li button { text-align: left; white-space: normal; }
.academy-workspace .ac-template-save-form .ac-field { margin: 0; }
.academy-workspace .ac-author-preview { display: grid; gap: 16px; min-width: 0; }
.academy-workspace .ac-preview-banner { display: grid; gap: 6px; padding: 18px; border: 1px solid var(--ac-line-strong); border-radius: 16px; background: var(--ac-selected); color: var(--ac-ink); }
.academy-workspace .ac-preview-result { padding: 14px; border-radius: 13px; border: 1px solid var(--ac-line); background: var(--ac-selected); color: var(--ac-ink); margin-top: 12px; }
.academy-workspace .ac-planning { display: grid; gap: 18px; min-width: 0; }
.academy-workspace .ac-planning > .ac-panel, .academy-workspace .ac-planning > .ac-kpis { margin-bottom: 0; }
.academy-workspace .ac-planning-editor { border-color: var(--ac-line-strong); box-shadow: ${systemLiquidGlass.shadowSoft}; }
.academy-workspace .ac-planning-editor > .ac-message { margin-bottom: 16px; }
.academy-workspace .ac-planning-editor .ac-card-actions { margin-top: 16px; }
.academy-workspace .ac-month-controls { display: flex; align-items: end; gap: 8px; flex-wrap: wrap; min-width: 0; }
.academy-workspace .ac-month-controls > .ac-field { flex: 1 1 155px; min-width: 0; }
.academy-workspace .ac-month-controls input { width: 100%; min-width: 0; }
.academy-workspace .ac-calendar { padding: 12px; border: 1px solid var(--ac-line); border-radius: 20px; background: var(--ac-glass); }
.academy-workspace .ac-calendar-week, .academy-workspace .ac-calendar-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
.academy-workspace .ac-calendar-week { margin: 0 0 9px; text-align: center; color: var(--ac-muted); font-size: 12px; font-weight: 700; }
.academy-workspace .ac-calendar-day { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-height: 95px; padding: 11px; color: var(--ac-ink); background: var(--ac-glass-strong); border: 1px solid var(--ac-line); border-radius: 13px; cursor: pointer; text-align: left; overflow-wrap: anywhere; transition: background .16s ease, border-color .16s ease; }
.academy-workspace .ac-calendar-day > span { font-size: 14px; font-weight: 750; font-variant-numeric: tabular-nums; }
.academy-workspace .ac-calendar-day > small { width: 100%; color: var(--ac-blue); font-size: 11px; font-weight: 650; line-height: 1.3; }
.academy-workspace .ac-calendar-day > small.ac-calendar-expiry { color: var(--ac-secondary); }
.academy-workspace .ac-calendar-day[aria-current="date"] > span { border-bottom: 3px solid var(--ac-blue); }
.academy-workspace .ac-calendar-day[aria-pressed="true"] { color: var(--ac-on-accent); border-color: var(--ac-line-strong); background: var(--ac-primary-gradient); box-shadow: ${systemLiquidGlass.shadowSoft}; }
.academy-workspace .ac-calendar-day[aria-pressed="true"] > small { color: var(--ac-on-accent); }
.academy-workspace .ac-calendar-day:disabled { cursor: wait; opacity: .6; }
.academy-workspace .ac-agenda-heading { margin-top: 22px; }
.academy-workspace .ac-agenda { display: grid; gap: 20px; }
.academy-workspace .ac-agenda-day { display: grid; grid-template-columns: minmax(85px, .18fr) minmax(0, 1fr); gap: 16px; min-width: 0; }
.academy-workspace .ac-agenda-day > h4 { padding-top: 13px; color: var(--ac-secondary); }
.academy-workspace .ac-date-history { margin-top: 4px; }
.academy-workspace .ac-date-history ol { list-style: none; display: grid; gap: 10px; margin: 7px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--ac-line-strong); }
.academy-workspace .ac-date-history li { display: grid; gap: 3px; color: var(--ac-secondary); }
.academy-workspace .ac-planning details[open] > .ac-list { margin-top: 16px; }
@media (hover: hover) and (pointer: fine) {
  .academy-workspace .ac-template-tile:hover { transform: translateY(-2px); border-color: var(--ac-line-strong); box-shadow: ${systemLiquidGlass.shadowSoft}; }
  .academy-workspace .ac-button:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 5px 14px ${systemLiquidGlass.glow.soft}; }
  .academy-workspace .ac-tab:not([aria-current="page"]):not(:disabled):hover { background: var(--ac-hover); }
  .academy-workspace .ac-course-card:hover { transform: translateY(-2px); border-color: var(--ac-line-strong); box-shadow: ${systemLiquidGlass.shadowSoft}; }
  .academy-workspace .ac-template-card:not(:disabled):hover, .academy-workspace .ac-lesson-nav:not(:disabled):hover { border-color: var(--ac-line-strong); background: var(--ac-selected); }
  .academy-workspace .ac-calendar-day:not(:disabled):not([aria-pressed="true"]):hover { border-color: var(--ac-line-strong); background: var(--ac-selected); }
}
@container academy (max-width: 880px) {
  .academy-workspace .ac-header { padding: 22px; gap: 15px; }
  .academy-workspace .ac-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .academy-workspace .ac-detail-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .academy-workspace .ac-detail-aside > h2, .academy-workspace .ac-detail-aside > h3,
  .academy-workspace .ac-detail-aside > .ac-review-form, .academy-workspace .ac-detail-aside > .ac-targets,
  .academy-workspace .ac-detail-aside > .ac-message, .academy-workspace .ac-detail-aside > .ac-button { grid-column: 1 / -1; }
  .academy-workspace .ac-editor-grid { grid-template-columns: minmax(180px, .7fr) minmax(0, 1.7fr); gap: 14px; }
  .academy-workspace .ac-panel { padding: 19px; }
  .academy-workspace .ac-calendar-day { min-height: 80px; padding: 8px; }
  .academy-workspace .ac-agenda-day { grid-template-columns: minmax(0, 1fr); gap: 8px; }
}
@container academy (max-width: 620px) {
  .academy-workspace .ac-template-catalog { grid-template-columns: minmax(0, 1fr); }
  .academy-workspace .ac-template-intro > .ac-panel-header > .ac-card-actions { width: 100%; }
  .academy-workspace .ac-template-intro > .ac-panel-header > .ac-card-actions > .ac-button { flex: 1 1 180px; }
  .academy-workspace .ac-author-tools > .ac-button, .academy-workspace .ac-question-actions > .ac-button { flex: 1 1 145px; }
  .academy-workspace .ac-readiness, .academy-workspace .ac-template-save-form, .academy-workspace .ac-lesson-presets { padding: 14px; }
  .academy-workspace .ac-header { padding: 20px; border-radius: 21px; }
  .academy-workspace .ac-brand-mark { width: 44px; height: 44px; flex-basis: 44px; border-radius: 14px; }
  .academy-workspace .ac-header-copy { flex-basis: 190px; }
  .academy-workspace .ac-header-actions { flex: 1 1 100%; }
  .academy-workspace .ac-header-actions > .ac-button { flex: 1 1 140px; }
  .academy-workspace .ac-tabs { gap: 4px; padding: 5px; border-radius: 15px; }
  .academy-workspace .ac-tab { flex: 1 1 calc(33% - 8px); padding: 9px 8px; font-size: 12px; }
  .academy-workspace .ac-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .academy-workspace .ac-kpi { padding: 15px; border-radius: 15px; }
  .academy-workspace .ac-kpi-value { font-size: 26px; }
  .academy-workspace .ac-panel { padding: 16px; border-radius: 18px; }
  .academy-workspace .ac-panel-header { gap: 12px; }
  .academy-workspace .ac-form-grid, .academy-workspace .ac-editor-grid, .academy-workspace .ac-detail-aside { grid-template-columns: minmax(0, 1fr); }
  .academy-workspace .ac-lesson-list { grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); }
  .academy-workspace .ac-editor-content { padding: 15px; }
  .academy-workspace .ac-toolbar > .ac-field, .academy-workspace .ac-search { flex-basis: 100%; }
  .academy-workspace .ac-list-row { padding: 13px; }
  .academy-workspace .ac-list-actions { flex: 1 1 100%; }
  .academy-workspace .ac-list-actions > .ac-button { flex: 1 1 120px; }
  .academy-workspace .ac-question { padding: 13px; }
  .academy-workspace .ac-editor-footer { justify-content: stretch; }
  .academy-workspace .ac-editor-footer > .ac-button { flex: 1 1 140px; }
  .academy-workspace .ac-editor-footer > .ac-card-actions { flex: 1 1 100%; }
  .academy-workspace .ac-editor-footer > .ac-card-actions > .ac-button { flex: 1 1 140px; }
  .academy-workspace .ac-empty { padding: 28px 16px; }
  .academy-workspace .ac-calendar { display: none; }
  .academy-workspace .ac-month-controls { flex: 1 1 100%; }
  .academy-workspace .ac-month-controls > .ac-button:last-child { flex: 1 1 100%; }
  .academy-workspace .ac-planning > .ac-panel { min-width: 0; }
  .academy-workspace .ac-agenda-heading { margin-top: 8px; }
}
@container academy (max-width: 360px) {
  .academy-workspace .ac-tab { flex-basis: calc(50% - 8px); }
  .academy-workspace .ac-kpis { grid-template-columns: minmax(0, 1fr); }
  .academy-workspace .ac-card-actions > .ac-button, .academy-workspace .ac-lesson-actions > .ac-button { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .academy-workspace *, .academy-workspace *::before, .academy-workspace *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  .academy-workspace .ac-course-card:hover, .academy-workspace .ac-button:hover, .academy-workspace .ac-template-tile:hover { transform: none; }
}
@media (forced-colors: active) {
  .academy-workspace .ac-status, .academy-workspace .ac-course-card, .academy-workspace .ac-panel,
  .academy-workspace .ac-tab[aria-current="page"], .academy-workspace .ac-lesson-nav[aria-current="step"],
  .academy-workspace .ac-quiz-option:has(input:checked) { border: 1px solid CanvasText; }
  .academy-workspace .ac-progress > span { background: Highlight; }
}
@keyframes ac-loading { 0%,100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
`;
