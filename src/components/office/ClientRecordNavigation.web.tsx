import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { CLIENT_RECORD_TAB_LABELS, type ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';

const details: Partial<Record<ClientRecordTabKey, [string, string]>> = {
  uebersicht: ['Auf einen Blick', 'Termine, Unterlagen und nächste Schritte'],
  stammdaten: ['Persönliche Angaben', 'Name, Versicherung und Stammdaten'],
  pflegegrad_budgets: ['Leistungen & Budgets', 'Pflegegrad, Ansprüche und Finanzierung'],
  kontakt: ['Kontakte & Angehörige', 'Erreichbarkeit und wichtige Kontaktpersonen'],
  einsaetze: ['Einsätze & Termine', 'Planung, Aufgaben und Betreuungswünsche'],
  dokumente: ['Dokumente & Nachweise', 'Verträge, Einwilligungen und Unterlagen'],
  portal: ['Zugang & Freigaben', 'Inhalte und Zugang zum Klientenportal'],
  verlauf: ['Aktivitäten', 'Änderungen und Verlauf der Akte'],
  mehr: ['Weitere Aktenbereiche', 'Fachliche Angaben und weitere Funktionen'],
  module: ['Betreuungsbereiche', 'Zuordnung der Betreuung'],
  audit: ['Änderungsprotokoll', 'Nachvollziehen, wer Angaben geändert hat'],
};

export function recordTabLabel(tab: ClientRecordTabKey) {
  return details[tab]?.[0] ?? CLIENT_RECORD_TAB_LABELS[tab];
}

function RecordIcon({ tab }: { tab: ClientRecordTabKey }) {
  const paths: Partial<Record<ClientRecordTabKey, ReactNode>> = {
    uebersicht: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    stammdaten: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    kontakt: <><path d="M5 3h13v18H5zM2 7h5M2 12h5M2 17h5" /><circle cx="12" cy="9" r="2" /><path d="M9 16a3 3 0 0 1 6 0" /></>,
    pflegegrad_budgets: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M7 15h3m7-3v5m-2-2h4" /></>,
    einsaetze: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3m-10 3h3" /></>,
    dokumente: <><path d="M14 3H5v18h14V8zm0 0v5h5M8 12h8m-8 4h6" /></>,
    portal: <><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6z" /><path d="m8 12 3 3 5-6" /></>,
    verlauf: <><path d="M4 8a9 9 0 1 1-1 7M3 3v6h6m3-3v6l4 2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[tab] ?? <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>}</svg>;
}

export function ClientRecordNavigation({ tabs, value, onChange, children }: {
  tabs: ClientRecordTabKey[];
  value: ClientRecordTabKey;
  onChange: (tab: ClientRecordTabKey) => void;
  children: ReactNode;
}) {
  const id = useId();
  const active = tabs.includes(value) ? value : tabs[0];
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % tabs.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index - 1 + tabs.length) % tabs.length : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next]);
    document.getElementById(`${id}-tab-${tabs[next]}`)?.focus();
  }
  return <>
    <style>{navigationCss}</style>
    <div className="cr-workspace">
      <nav className="cr-navigation" aria-label="Bereiche der Klientenakte">
        <span className="cr-nav-title">In dieser Akte</span>
        <div role="tablist" aria-label="Aktenbereiche" aria-orientation="vertical">
          {tabs.map((tab, index) => <button key={tab} type="button" role="tab" id={`${id}-tab-${tab}`} aria-selected={active === tab} aria-controls={`${id}-panel`} tabIndex={active === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={event => onKey(event, index)}>
            <RecordIcon tab={tab} /><span>{recordTabLabel(tab)}</span><b aria-hidden="true">›</b>
          </button>)}
        </div>
      </nav>
      <section className="cr-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
        <div className="cr-content-heading"><h2>{recordTabLabel(active)}</h2>{details[active]?.[1] ? <p>{details[active][1]}</p> : null}</div>
        {children}
      </section>
    </div>
  </>;
}

export function ClientRecordMetrics({ documents, appointments, assignments, openItems, tabs, onChange }: {
  documents: number; appointments: number; assignments: number; openItems: number;
  tabs: ClientRecordTabKey[]; onChange: (tab: ClientRecordTabKey) => void;
}) {
  const items: { label: string; value: number; tab: ClientRecordTabKey; hint: string }[] = [
    { label: 'Dokumente', value: documents, tab: 'dokumente', hint: 'Unterlagen öffnen' },
    { label: 'Erfasste Termine', value: appointments, tab: 'einsaetze', hint: 'Terminübersicht öffnen' },
    { label: 'Einsätze', value: assignments, tab: 'einsaetze', hint: 'Einsätze ansehen' },
    { label: 'Prüfpunkte', value: openItems, tab: 'uebersicht', hint: 'Offene Angaben prüfen' },
  ];
  return <div className="cr-metrics" aria-label="Zusammenfassung der Akte">{items.map(item => {
    const content = <><span className="cr-metric-icon"><RecordIcon tab={item.tab} /></span><span className="cr-metric-copy"><span>{item.label}</span><strong>{item.value}</strong></span>{tabs.includes(item.tab) ? <span className="cr-metric-arrow" aria-hidden="true">↗</span> : null}</>;
    return tabs.includes(item.tab) ? <button type="button" key={item.label} onClick={() => onChange(item.tab)} title={item.hint}>{content}</button> : <div key={item.label}>{content}</div>;
  })}</div>;
}

const navigationCss = `
.cr-shell{container:client-record / inline-size;display:flex;flex-direction:column;gap:20px;min-width:0;width:100%;font-family:inherit;color:#172b47}.cr-shell *{box-sizing:border-box}.cr-shell button{font-family:inherit}.cr-workspace{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:start;min-width:0}.cr-navigation{padding:16px 10px;background:#f4f8fd;border:1px solid #d8e3f0;border-radius:18px}.cr-nav-title{display:block;margin:3px 12px 13px;color:#60738e;letter-spacing:1.2px;font-size:11px;font-weight:750;text-transform:uppercase}.cr-navigation [role=tablist]{display:flex;flex-direction:column;gap:5px}.cr-navigation button{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:12px 10px;min-height:45px;border:1px solid transparent;border-radius:11px;background:transparent;color:#425670;font-size:13px;font-weight:550;line-height:1.4;cursor:pointer}.cr-navigation button svg{width:19px;height:19px;flex-shrink:0;stroke:currentColor;fill:none;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.cr-navigation button span{flex:1;min-width:0;overflow-wrap:anywhere}.cr-navigation button b{opacity:0;font-size:19px;font-weight:400}.cr-navigation button:hover{background:#e7effa;color:#144ea2}.cr-navigation button[aria-selected=true]{background:#fff;border-color:#c4d7f2;box-shadow:0 3px 12px #153c6c0c;color:#1556b1;font-weight:650}.cr-navigation button[aria-selected=true] b{opacity:1}.cr-navigation button:focus-visible,.cr-metrics button:focus-visible,.cr-content:focus-visible{outline:3px solid #337ff0;outline-offset:3px}.cr-content{min-width:0}.cr-content-heading{margin:2px 0 20px}.cr-content-heading h2{margin:0;color:#102944;font-size:21px;font-weight:650;letter-spacing:-.45px;line-height:1.35}.cr-content-heading p{margin:6px 0 0;color:#5d7089;font-size:13px;line-height:1.6}
.cr-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.cr-metrics>button,.cr-metrics>div{display:flex;align-items:center;gap:12px;text-align:left;padding:15px 18px;min-height:88px;border:1px solid #dbe5f2;border-radius:17px;background:linear-gradient(135deg,#fff,#f8fbff);box-shadow:0 4px 14px #123e6a05;color:#122d4d}.cr-metrics>button{cursor:pointer;transition:border-color .2s,box-shadow .2s}.cr-metrics>button:hover{border-color:#7dabe9;box-shadow:0 5px 20px #1c69c410}.cr-metric-icon{width:37px;height:37px;border-radius:12px;display:grid;place-items:center;background:#eaf2fd;color:#2c65aa;flex-shrink:0}.cr-metric-icon svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.cr-metric-copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.cr-metric-copy>span{font-size:12px;line-height:1.4;color:#59708b;overflow-wrap:anywhere}.cr-metric-copy strong{font-size:25px;line-height:1.2;font-weight:650;letter-spacing:-.7px;color:#143557}.cr-metric-arrow{align-self:flex-start;color:#7189a8;font-size:17px}.cr-record-management{border-top:1px solid #dbe4f0;padding-top:15px;margin-top:4px}.cr-record-management summary{cursor:pointer;font-size:13px;color:#617189;padding:8px 0;min-height:38px}.cr-record-management summary:focus-visible{outline:3px solid #337ff0;outline-offset:2px}.cr-record-management .cr-management-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:16px 0}.cr-record-management p{font-size:13px;line-height:1.6;color:#5d7089;margin:0}
@container client-record (max-width:950px){.cr-workspace{grid-template-columns:185px minmax(0,1fr);gap:18px}.cr-metrics{gap:8px}.cr-metrics>button,.cr-metrics>div{padding:14px 12px;gap:9px}.cr-metric-icon{width:30px;height:30px}.cr-metric-arrow{display:none}.cr-navigation button{font-size:12px}}
@container client-record (max-width:720px){.cr-workspace{grid-template-columns:minmax(0,1fr);gap:18px}.cr-navigation{padding:12px}.cr-nav-title{margin:0 4px 10px}.cr-navigation [role=tablist]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.cr-navigation button{height:100%;padding:10px 8px;gap:7px}.cr-navigation button b{display:none}.cr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cr-content-heading{margin-bottom:16px}.cr-hero{grid-template-columns:minmax(0,1fr) 175px;padding:25px 22px;gap:8px}.cr-folder-stage{height:190px}.cr-folder{scale:.8}}
@container client-record (max-width:480px){.cr-navigation [role=tablist]{grid-template-columns:repeat(2,minmax(0,1fr))}.cr-navigation button{min-height:50px;font-size:13px}.cr-navigation button svg{width:16px;height:16px}.cr-hero{grid-template-columns:minmax(0,1fr);padding:24px;min-height:0}.cr-folder-stage{display:none}.cr-hero h1{font-size:29px}.cr-hero-edit{width:100%;min-height:46px}.cr-shell{gap:16px}.cr-metrics>button,.cr-metrics>div{padding:13px 11px;min-height:82px}.cr-metric-copy>span{font-size:12px}.cr-metric-copy strong{font-size:23px}.cr-metric-icon{display:none}}
@media(prefers-reduced-motion:reduce){.cr-metrics>button{transition:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
