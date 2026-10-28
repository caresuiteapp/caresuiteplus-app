// Generated native presentation from src/components/calendar/CalendarDialogContent.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import type { ReactNode } from 'react';
/** Shared web form treatment. Styles stay scoped to calendar dialogs. */
export function CalendarDialogContent({ children }: {
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[CSS, CSS]}>{<NativeDiv className="cs-calendar-dialog">
    <NativeStyle>{CSS}</NativeStyle>
    {children}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
const CSS = `
.cs-calendar-dialog{--calendar-ink:#173452;--calendar-muted:#56708a;--calendar-blue:#096fda;color:var(--calendar-ink);width:100%;min-width:0;font-family:inherit;font-size:15px;line-height:1.5}
.cs-calendar-dialog *{box-sizing:border-box}
.cs-calendar-dialog h2,.cs-calendar-dialog h3,.cs-calendar-dialog p{margin:0}
.cs-calendar-dialog h2{font-size:24px;line-height:1.25;letter-spacing:-.025em}
.cs-calendar-dialog h3{font-size:17px;line-height:1.35}
.cs-calendar-dialog button,.cs-calendar-dialog input,.cs-calendar-dialog select,.cs-calendar-dialog textarea{font:inherit}
.cs-calendar-dialog button{cursor:pointer;transition:border-color .18s,background .18s,box-shadow .18s,transform .18s}
.cs-calendar-dialog :is(button,input,select,textarea):focus-visible{outline:3px solid #2c86e9;outline-offset:3px}
.cs-calendar-dialog :is(button,input,select,textarea):disabled{cursor:default;opacity:.55}
.cs-calendar-dialog .cd-stack{display:flex;flex-direction:column;gap:18px;min-width:0}
.cs-calendar-dialog .cd-step-header{display:flex;flex-direction:column;gap:6px;margin-bottom:20px}
.cs-calendar-dialog .cd-muted{color:var(--calendar-muted)}
.cs-calendar-dialog .cd-eyebrow{color:var(--calendar-blue);font-size:12px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}
.cs-calendar-dialog .cd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:18px}
.cs-calendar-dialog .cd-full{grid-column:1/-1}
.cs-calendar-dialog .cd-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-weight:650}
.cs-calendar-dialog .cd-field small{font-size:13px;font-weight:400;color:var(--calendar-muted)}
.cs-calendar-dialog .cd-field :is(input,select,textarea),.cs-calendar-dialog .cd-search{width:100%;min-width:0;min-height:48px;background:#fff!important;color:#173452!important;border:1px solid #b9cfe5;border-radius:12px;padding:11px 13px;font-weight:400}
.cs-calendar-dialog .cd-field textarea{min-height:105px;resize:vertical}
.cs-calendar-dialog .cd-people{margin:0;padding:18px;border:1px solid #c9ddef;border-radius:16px;background:#f8fbff;gap:12px}
.cs-calendar-dialog .cd-people legend{padding:0 6px;font-size:16px}
.cs-calendar-dialog .cd-people p{font-size:13px;font-weight:400}
.cs-calendar-dialog .cd-people-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.cs-calendar-dialog .cd-people-search{flex:1 1 220px}
.cs-calendar-dialog .cd-people-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:8px;max-height:240px;overflow-y:auto;overscroll-behavior:contain;padding:5px}
.cs-calendar-dialog .cd-person-option{display:flex;align-items:center;gap:10px;min-width:0;min-height:46px;padding:10px 12px;border:1px solid #d4e3f2;border-radius:10px;background:#fff;cursor:pointer;font-weight:500}
.cs-calendar-dialog .cd-person-option:has(input:checked){background:#edf6ff;border-color:#368ee9}
.cs-calendar-dialog .cd-person-option input{width:20px;min-height:20px;height:20px;flex:0 0 20px;padding:0;margin:0;accent-color:#096fda}
.cs-calendar-dialog .cd-person-option span{overflow-wrap:anywhere;min-width:0}
.cs-calendar-dialog .cd-people-selected{display:flex;flex-wrap:wrap;gap:7px;list-style:none;padding:0;margin:0}
.cs-calendar-dialog .cd-people-selected li{display:flex;align-items:center;gap:4px;max-width:100%;padding:3px 3px 3px 11px;border:1px solid #b9d9f5;border-radius:18px;background:#e9f3ff;font-size:13px;font-weight:500}
.cs-calendar-dialog .cd-people-selected span{min-width:0;overflow-wrap:anywhere}
.cs-calendar-dialog .cd-people-selected button{flex:0 0 32px;width:32px;min-height:32px;border:0;border-radius:50%;color:#145b9b;background:transparent;font-size:21px;line-height:1}
.cs-calendar-dialog .cd-people-selected button:hover:not(:disabled){background:#cfe5fb}
.cs-calendar-dialog .cd-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cs-calendar-dialog .cd-panel{border:1px solid #d4e3f2;border-radius:18px;padding:20px;background:linear-gradient(145deg,#fff,#f5f9ff);box-shadow:0 5px 18px #24629308;min-width:0}
.cs-calendar-dialog .cd-choice{display:flex;flex-direction:column;gap:9px;width:100%;min-width:0;text-align:left;padding:18px;border:1px solid #c9ddef;border-radius:16px;color:var(--calendar-ink);background:#fff}
.cs-calendar-dialog .cd-choice:hover:not(:disabled){border-color:#368ee9;background:#f1f8ff;box-shadow:0 7px 20px #0d6bd314;transform:translateY(-1px)}
.cs-calendar-dialog .cd-choice[aria-pressed=true]{border-color:#1476d9;background:#edf6ff}
.cs-calendar-dialog .cd-choice strong{font-size:17px}.cs-calendar-dialog .cd-choice small{font-size:13px;color:var(--calendar-muted)}
.cs-calendar-dialog .cd-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;background:#e9f3ff;color:#1766ae;font-size:13px;font-weight:650;width:fit-content}
.cs-calendar-dialog .cd-toggle{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid #d1e0ef;border-radius:14px;background:#fff;cursor:pointer;min-width:0}
.cs-calendar-dialog .cd-toggle input{flex:0 0 20px;width:20px;height:20px;accent-color:#096fda;padding:0!important;margin:0}
.cs-calendar-dialog .cd-toggle span{display:flex;flex-direction:column;gap:3px;min-width:0}.cs-calendar-dialog .cd-toggle small{font-size:13px;color:var(--calendar-muted)}
.cs-calendar-dialog .cd-link{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 14px;border:1px solid #c8dbed;border-radius:11px;background:#fff;color:#0864b9;font-weight:650}
.cs-calendar-dialog .cd-link:hover:not(:disabled){background:#edf6ff;border-color:#247ed5}
.cs-calendar-dialog .cd-alert{padding:12px 15px;border:1px solid #efb8ba;background:#fff2f2;border-radius:12px;color:#a02630}
.cs-calendar-dialog .cd-info{padding:12px 15px;border:1px solid #b9d9f5;background:#edf6ff;border-radius:12px;color:#255d8c}
.cs-calendar-dialog .cd-steps{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:22px;list-style:none;padding:0}
.cs-calendar-dialog .cd-steps li{display:flex;align-items:center;gap:7px;color:#62768b;font-size:13px;padding:6px 10px;border-radius:20px;background:#e9eff6}
.cs-calendar-dialog .cd-steps li[aria-current=step]{background:#096fda;color:white;font-weight:700}
.cs-calendar-dialog .cd-steps .cd-done{color:#126153;background:#e5f5f1}
.cs-calendar-dialog .cd-details{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,2.4fr);gap:12px 20px;margin:0}
.cs-calendar-dialog .cd-details dt{color:var(--calendar-muted);font-size:14px}.cs-calendar-dialog .cd-details dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.cs-calendar-dialog .cd-footer-note{font-size:13px;color:var(--calendar-muted)}
.cs-calendar-dialog .cd-danger{border-color:#ecc9cc;color:#a02936}.cs-calendar-dialog .cd-danger:hover:not(:disabled){background:#fff1f2;border-color:#b94755}
@media(max-width:580px){.cs-calendar-dialog h2{font-size:21px}.cs-calendar-dialog .cd-panel{padding:15px}.cs-calendar-dialog .cd-details{grid-template-columns:1fr;gap:4px}.cs-calendar-dialog .cd-details dd{margin-bottom:10px}.cs-calendar-dialog .cd-steps{gap:5px}.cs-calendar-dialog .cd-steps li{font-size:12px;padding:5px 8px}}
@media(prefers-reduced-motion:reduce){.cs-calendar-dialog button{transition:none}.cs-calendar-dialog .cd-choice:hover{transform:none}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
