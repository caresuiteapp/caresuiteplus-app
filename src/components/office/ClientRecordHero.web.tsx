import type { PointerEvent } from 'react';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import type { WorkflowStatus } from '@/types/core/base';

type Props = {
  clientId: string;
  firstName: string;
  lastName: string;
  careLevel: string | null;
  city: string | null;
  status: WorkflowStatus;
  careContexts: ClientCareContext[];
  archiveError?: string | null;
  showEdit?: boolean;
  onEdit?: () => void;
};

function moveFolder(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  element.style.setProperty('--folder-x', `${(event.clientY - rect.top) / rect.height * -8 + 8}deg`);
  element.style.setProperty('--folder-y', `${(event.clientX - rect.left) / rect.width * 12 - 16}deg`);
}

export function ClientRecordHero({ firstName, lastName, careLevel, city, status, careContexts, archiveError, showEdit, onEdit }: Props) {
  const fullName = `${firstName} ${lastName}`.trim();
  return <>
    <style>{heroCss}</style>
    <header className="cr-hero">
      <div className="cr-hero-copy">
        <div className="cr-hero-eyebrow"><span />Persönliche Klientenakte</div>
        <h1>{fullName || 'Klientenakte'}</h1>
        <div className="cr-hero-meta">
          <span className="cr-hero-status" data-status={status}>{WORKFLOW_STATUS_LABELS[status] ?? 'Status nicht hinterlegt'}</span>
          {careLevel ? <span>{formatCareLevel(careLevel)}</span> : null}
          {city ? <span>{city}</span> : null}
        </div>
        {careContexts.length ? <p className="cr-hero-services">{careContexts.map(context => getCatalogLabel('leistungsart', context)).join(' · ')}</p> : <p className="cr-hero-services">Die Angaben zur Betreuung finden Sie in den Aktenbereichen.</p>}
        {showEdit && onEdit ? <button type="button" className="cr-hero-edit" onClick={onEdit}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z" /></svg>Stammdaten bearbeiten</button> : null}
      </div>
      <div className="cr-folder-stage" aria-hidden="true" onPointerMove={moveFolder} onPointerLeave={event => { event.currentTarget.style.removeProperty('--folder-x'); event.currentTarget.style.removeProperty('--folder-y'); }}>
        <div className="cr-folder-halo" />
        <div className="cr-folder">
          <div className="cr-folder-back" />
          <div className="cr-folder-paper cr-folder-paper-back"><i /><i /><i /></div>
          <div className="cr-folder-paper"><div className="cr-paper-heading" /><i /><i /><i /><i /></div>
          <div className="cr-folder-cover">
            <div className="cr-folder-ridge" />
            <div className="cr-folder-monogram">{firstName.slice(0, 1)}{lastName.slice(0, 1)}</div>
            <div className="cr-folder-caption">CARE<span>SUITE</span><strong>Klientenakte</strong><small>HEALTH OS</small></div>
            <svg className="cr-folder-seal" viewBox="0 0 24 24"><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6z" /><path d="m8 12 3 3 5-6" /></svg>
          </div>
        </div>
      </div>
    </header>
    {archiveError ? <p className="cr-hero-error" role="alert">{archiveError}</p> : null}
  </>;
}

const heroCss = `
.cr-hero{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) 270px;align-items:center;gap:20px;overflow:hidden;border:1px solid #345379;border-radius:26px;background:radial-gradient(ellipse at 92% 5%,#214e85 0,transparent 52%),linear-gradient(120deg,#0a1934,#122e53);box-shadow:0 18px 45px #091a3424,inset 0 1px #ffffff25;color:#fff;padding:30px 36px;min-height:240px;container-type:inline-size;font-family:inherit}
.cr-hero:after{content:'';position:absolute;z-index:-1;inset:0;background:linear-gradient(125deg,transparent 50%,#ffffff07 50%,transparent 76%);pointer-events:none}
.cr-hero-copy{min-width:0}.cr-hero-eyebrow{display:flex;align-items:center;gap:9px;color:#b7d5f8;font-size:12px;line-height:1.5;letter-spacing:1.8px;text-transform:uppercase;font-weight:650}.cr-hero-eyebrow>span{width:6px;height:6px;border-radius:50%;background:#75cfff;box-shadow:0 0 12px #45b4f8}
.cr-hero h1{font-size:clamp(calc(26px * var(--app-font-scale,1)),3vw,calc(38px * var(--app-font-scale,1)));line-height:1.18;letter-spacing:-1px;margin:13px 0 16px;font-weight:650;color:#fff;overflow-wrap:anywhere}
.cr-hero-meta{display:flex;align-items:center;gap:10px 17px;flex-wrap:wrap;font-size:14px;color:#e5effb}.cr-hero-status{padding:5px 12px;border:1px solid #7e9fca;border-radius:50px;background:#234165;color:#f0f6ff;font-weight:650}.cr-hero-status[data-status=aktiv]{background:#123f40;border-color:#438d82;color:#acedd8}.cr-hero-status[data-status=entwurf],.cr-hero-status[data-status=in_bearbeitung]{color:#ffdeb0;border-color:#9e7d4e;background:#44371e}
.cr-hero-services{font-size:14px;line-height:1.65;color:#c2d5ef;margin:13px 0 0;max-width:60ch}.cr-hero-edit{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:9px 15px;margin-top:20px;border:1px solid #7296c6;border-radius:12px;background:#ffffff10;color:#fff;font-size:14px;font-weight:600;line-height:1.4;font-family:inherit;cursor:pointer;transition:background .2s,border-color .2s}.cr-hero-edit:hover{background:#ffffff24;border-color:#c5dcfc}.cr-hero-edit:focus-visible{outline:3px solid #b4e6ff;outline-offset:4px}.cr-hero-edit svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.cr-hero-error{border:1px solid #f5b4b4;background:#fff0f0;color:#942222;border-radius:12px;padding:12px 16px;font-size:14px}
.cr-folder-stage{height:225px;position:relative;perspective:900px;display:grid;place-items:center}.cr-folder-halo{position:absolute;width:220px;height:180px;border-radius:50%;background:#2f93ff;filter:blur(52px);opacity:.24}.cr-folder{position:relative;width:205px;height:163px;transform:rotateX(var(--folder-x,6deg)) rotateY(var(--folder-y,-13deg)) rotateZ(-7deg);transform-style:preserve-3d;transition:transform .3s ease;filter:drop-shadow(14px 27px 16px #010b2170)}
.cr-folder-back{position:absolute;inset:-12px 0 0;border:1px solid #6da2ea;border-radius:8px 17px 17px 12px;background:linear-gradient(145deg,#5c8fca,#235288);transform:translateZ(-10px)}.cr-folder-back:before{content:'';position:absolute;left:0;top:-13px;width:83px;height:24px;border-radius:9px 12px 0 0;background:#5488c3;border-top:1px solid #8dbdf1}
.cr-folder-paper{position:absolute;inset:-5px 9px 8px 13px;transform:translateZ(1px) rotate(-2deg);border-radius:6px;background:linear-gradient(135deg,#f9fcff,#c9d9ec);padding:15px 20px;box-shadow:0 0 0 1px #b7d1ec,0 2px 6px #06285133;transition:transform .35s ease}.cr-folder-paper-back{transform:translateZ(-3px) rotate(5deg);background:#a6c2e2}.cr-paper-heading{height:9px;width:60%;border-radius:4px;background:#9cb6d8;margin-bottom:14px}.cr-folder-paper i{display:block;height:3px;background:#a6bddd;border-radius:5px;margin:8px 0}.cr-folder-paper i:nth-child(odd){width:72%}
.cr-folder-cover{position:absolute;inset:22px 0 0;border:1px solid #8bbafa;border-radius:8px 11px 13px 13px;background:linear-gradient(125deg,#4c8bdfbb,#2767b9e6 55%,#1b4f93f5);box-shadow:inset 0 1px 1px #d3ebffa3,inset 0 -2px 5px #062c7777;transform:translateZ(16px);transform-origin:center bottom;transition:transform .35s ease;backdrop-filter:blur(3px);overflow:hidden}.cr-folder-cover:after{content:'';position:absolute;inset:0;background:linear-gradient(125deg,transparent 35%,#ffffff27 45%,transparent 56%);pointer-events:none}.cr-folder-ridge{position:absolute;inset:0 auto 0 12px;width:3px;border-left:1px solid #a3d1ff8c;border-right:1px solid #032b6d4d}.cr-folder-monogram{position:absolute;top:17px;left:29px;font-size:30px;font-weight:500;letter-spacing:-1px;color:#eff8ff}.cr-folder-caption{position:absolute;left:30px;bottom:16px;font-size:9px;letter-spacing:1px;font-weight:750;color:#d8edff}.cr-folder-caption>span{font-weight:400}.cr-folder-caption strong{display:block;font-size:15px;font-weight:550;letter-spacing:0;margin-top:5px;color:#fff}.cr-folder-caption small{display:block;font-size:7px;letter-spacing:2px;margin-top:7px;color:#c8dffc}.cr-folder-seal{position:absolute;right:17px;bottom:21px;width:25px;height:25px;stroke:#c6e5ff;fill:none;stroke-width:1.2}
@media(hover:hover) and (prefers-reduced-motion:no-preference){.cr-folder-stage:hover .cr-folder-cover{transform:translateZ(22px) rotateX(-12deg)}.cr-folder-stage:hover .cr-folder-paper{transform:translateY(-7px) translateZ(3px) rotate(-2deg)}.cr-folder-stage:hover .cr-folder-paper-back{transform:translateY(-10px) translateZ(-3px) rotate(6deg)}}
@container(max-width:650px){.cr-folder-stage{height:180px}.cr-folder{scale:.83}}
@media(max-width:760px){.cr-hero{grid-template-columns:minmax(0,1fr) 165px;padding:25px 22px;gap:8px}.cr-folder-stage{height:190px}.cr-folder{scale:.8}}
@media(max-width:520px){.cr-hero{grid-template-columns:minmax(0,1fr);padding:24px;min-height:0}.cr-folder-stage{display:none}.cr-hero h1{font-size:29px}.cr-hero-edit{width:100%;min-height:46px}}
@media(prefers-reduced-motion:reduce){.cr-folder,.cr-folder-cover,.cr-folder-paper,.cr-hero-edit{transition:none}.cr-folder{transform:rotateY(-10deg) rotateZ(-5deg)}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
