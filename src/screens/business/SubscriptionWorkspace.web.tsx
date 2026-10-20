import { useId, useState } from 'react';
import type { ProductKey } from '@/types';
import type { SubscriptionWorkspaceSnapshot } from '@/lib/business/subscriptionWorkspaceService.web';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork.web';
import { DesktopCatalogIcon } from '@/liquid-command/components/DesktopCatalogIcon.web';
import { SUBSCRIPTION_WORKSPACE_CSS } from './subscriptionWorkspaceCss.web';

const PRODUCTS: Record<ProductKey, { name: string; description: string; route: string; tone: string }> = {
  office: { name: 'Office', description: 'Organisation, Mitarbeitende und Verwaltung an einem Ort.', route: '/office', tone: 'blue' },
  assist: { name: 'Assist', description: 'Alltagsbegleitung, Einsätze und Leistungsnachweise.', route: '/assist', tone: 'teal' },
  pflege: { name: 'Pflege', description: 'Pflegeprozesse, Dokumentation und Versorgung.', route: '/pflege', tone: 'violet' },
  beratung: { name: 'Beratung', description: 'Beratungsgespräche, Termine und Dokumentation.', route: '/beratung', tone: 'orange' },
  stationaer: { name: 'Stationär', description: 'Bewohner, Wohnbereiche und stationäre Abläufe.', route: '/stationaer', tone: 'rose' },
  akademie: { name: 'Akademie', description: 'Lernen, Schulungen und Wissensvermittlung.', route: '/akademie', tone: 'indigo' },
};

const FEATURES = [
  { name: 'Kommunikation', description: 'Nachrichten und interne Abstimmung', route: '/business/messages' },
  { name: 'Dokumente', description: 'Unterlagen geordnet verwalten', route: '/business/office/documents' },
  { name: 'Vorlagen', description: 'Dokumente aus Vorlagen erstellen', route: '/business/templates' },
  { name: 'Qualitätsmanagement', description: 'Qualität und Abläufe im Blick', route: '/business/office/qm' },
  { name: 'Portale', description: 'Zugänge für Mitarbeitende und Klienten', route: '/business/office/portals' },
  { name: 'Auswertungen', description: 'Kennzahlen und Berichte', route: '/business/reporting' },
] as const;

const STATE_LABELS = { active: 'Freigeschaltet', inactive: 'Nicht freigeschaltet', blocked: 'Gesperrt', prepared: 'In Vorbereitung' } as const;
type ModuleFilter = 'all' | 'active' | 'unavailable';

function ActionIcon({ kind }: { kind: 'refresh' | 'arrow' | 'check' | 'search' | 'info' }) {
  const paths = {
    refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
    arrow: 'M4 12h16m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6',
    search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
    info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6M12 7h.01',
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}

export type SubscriptionWorkspaceProps = {
  data: SubscriptionWorkspaceSnapshot;
  loading: boolean;
  error: string | null;
  roleLabel: string | null;
  onRefresh: () => void;
  onOpenApps: (() => void) | null;
  /** Only provided for destinations whose navigation permission is available. */
  moduleActions: Partial<Record<ProductKey, () => void>>;
};

export function SubscriptionWorkspace({ data, loading, error, roleLabel, onRefresh, onOpenApps, moduleActions }: SubscriptionWorkspaceProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ModuleFilter>('all');
  const term = query.trim().toLocaleLowerCase('de-DE');
  const filtered = data.modules.filter((module) => {
    const product = PRODUCTS[module.key];
    return (filter === 'all' || (filter === 'active' ? module.status === 'active' : module.status !== 'active')) &&
      `${product.name} ${product.description} ${STATE_LABELS[module.status]} ${module.reason}`.toLocaleLowerCase('de-DE').includes(term);
  });
  const checkedDate = new Date(data.loadedAt);
  const checkedTime = Number.isNaN(checkedDate.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(checkedDate);
  const disabled = loading || Boolean(error);

  return <div className="cs-platform" data-testid="subscription-workspace">
    <style>{SUBSCRIPTION_WORKSPACE_CSS}</style>
    <header className="cs-platform-heading">
      <div><p className="cs-platform-eyebrow">Ihr CareSuite+</p><h1>Plattform &amp; Module</h1><p className="cs-platform-tenant">{data.tenantName}{data.source === 'demo' ? <span className="cs-platform-demo">Demo</span> : null}</p></div>
      <button type="button" className="cs-platform-button cs-platform-button--quiet" onClick={onRefresh} disabled={loading}><ActionIcon kind="refresh" />{loading ? 'Wird aktualisiert…' : 'Aktualisieren'}</button>
    </header>

    {error ? <div className="cs-platform-feedback" role="alert"><ActionIcon kind="info" /><div><strong>Aktualisierung fehlgeschlagen</strong><p>{error} Die angezeigten Angaben stammen vom letzten erfolgreichen Abruf. Bitte erneut aktualisieren.</p></div></div> : null}
    <section className="cs-platform-plan" aria-labelledby={`${id}-plan`}>
      <div className="cs-platform-plan-intro">
        <div className="cs-platform-plan-art"><DesktopCatalogArtwork route="/office" label="CareSuite+" size={76} /></div>
        <div><span className="cs-platform-badge cs-platform-badge--active"><ActionIcon kind="check" />Dauerhaft kostenlos</span><h2 id={`${id}-plan`}>Raum für Ihre tägliche Arbeit.</h2><p>Die CareSuite+ Basisplattform für Ihr Unternehmen.</p></div>
      </div>
      <div className="cs-platform-price"><span><strong>0 €</strong> / Monat</span><p>Keine Kreditkarte · Keine Testphase</p></div>
      <div className="cs-platform-plan-facts">
        <div><strong>{data.activeModuleCount}<span> / {data.totalModuleCount}</span></strong><p>Module freigeschaltet</p></div>
        <div><strong>{data.platformFeatureCount}</strong><p>Plattform-Funktionen enthalten</p></div>
        <div className="cs-platform-plan-explanation"><ActionIcon kind="info" /><p>Freigaben und Ihre Rolle bestimmen, welche Bereiche Sie nutzen können.</p></div>
      </div>
    </section>

    <section className="cs-platform-modules" aria-labelledby={`${id}-modules`}>
      <div className="cs-platform-section-heading"><div><h2 id={`${id}-modules`}>Ihre Module</h2><p>Alle Hauptmodule gehören zum kostenlosen Plattformumfang.</p></div>{onOpenApps ? <button type="button" className="cs-platform-button cs-platform-button--primary" disabled={disabled} onClick={onOpenApps}>Apps &amp; Widgets<ActionIcon kind="arrow" /></button> : null}</div>
      <div className="cs-platform-toolbar">
        <div className="cs-platform-filters" role="group" aria-label="Module filtern">
          {([{ value: 'all', label: 'Alle', count: data.totalModuleCount }, { value: 'active', label: 'Freigeschaltet', count: data.activeModuleCount }, { value: 'unavailable', label: 'Weitere', count: data.totalModuleCount - data.activeModuleCount }] as const).map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span>{item.count}</span></button>)}
        </div>
        <label className="cs-platform-search"><ActionIcon kind="search" /><span className="cs-platform-sr">Module durchsuchen</span><input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Modul suchen…" /></label>
      </div>
      <p className="cs-platform-sr" role="status">{filtered.length} {filtered.length === 1 ? 'Modul gefunden' : 'Module gefunden'}</p>
      {filtered.length ? <div className="cs-platform-grid">{filtered.map((module) => {
        const product = PRODUCTS[module.key];
        const action = module.status === 'active' ? moduleActions[module.key] : undefined;
        return <article className={`cs-platform-module cs-platform-module--${product.tone}`} key={module.key}>
          <div className="cs-platform-module-top"><div className="cs-platform-module-art"><DesktopCatalogArtwork route={product.route} label={product.name} size={60} /></div><span className={`cs-platform-badge cs-platform-badge--${module.status}`}>{STATE_LABELS[module.status]}</span></div>
          <h3>CareSuite+ {product.name}</h3><p className="cs-platform-description">{product.description}</p>
          <div className="cs-platform-module-bottom"><p className="cs-platform-reason">{module.reason}</p>{action ? <button type="button" className="cs-platform-open" disabled={disabled} onClick={action} aria-label={`${product.name} öffnen`}>Öffnen<ActionIcon kind="arrow" /></button> : module.status === 'active' ? <p className="cs-platform-access-note">Für Ihre Rolle ist hier kein direkter Zugang verfügbar.</p> : null}</div>
        </article>;
      })}</div> : <div className="cs-platform-empty"><DesktopCatalogIcon route="/settings/apps-widgets" size={32} /><h3>Keine passenden Module</h3><p>Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.</p><button type="button" className="cs-platform-button" onClick={() => { setQuery(''); setFilter('all'); }}>Filter zurücksetzen</button></div>}
    </section>

    <section className="cs-platform-features" aria-labelledby={`${id}-features`}>
      <div className="cs-platform-section-heading"><div><h2 id={`${id}-features`}>Im Plattformumfang enthalten</h2><p>Diese Funktionen ergänzen die Hauptmodule. Der Zugang richtet sich nach Freigaben und Berechtigungen.</p></div></div>
      <div className="cs-platform-feature-grid">{FEATURES.map((feature) => <div className="cs-platform-feature" key={feature.name}><span className="cs-platform-feature-icon"><DesktopCatalogIcon route={feature.route} size={23} /></span><div><h3>{feature.name}</h3><p>{feature.description}</p></div></div>)}</div>
    </section>

    <div className="cs-platform-bottom-grid">
      <section className="cs-platform-connections" aria-labelledby={`${id}-connections`}><span className="cs-platform-feature-icon cs-platform-feature-icon--violet"><DesktopCatalogIcon route="/business/connect" size={25} /></span><h2 id={`${id}-connections`}>Externe Anbindungen</h2><p>DATEV, KIM, TI-Anbindung und E-Rezept sind als zusätzliche Dienste vorgesehen. Hier können sie noch nicht gebucht oder aktiviert werden.</p><span className="cs-platform-badge cs-platform-badge--prepared">In Vorbereitung</span></section>
      <section className="cs-platform-faq" aria-labelledby={`${id}-faq`}><h2 id={`${id}-faq`}>Gut zu wissen</h2><details><summary>Warum sind nicht alle Module freigeschaltet?</summary><p>Kostenlos enthalten bedeutet nicht automatisch freigegeben. Modulstatus, technische Verfügbarkeit und Ihre Berechtigungen bestimmen den Zugang. Die jeweilige Modulkarte zeigt den aktuellen Stand.</p></details><details><summary>Wo passe ich meinen Desktop an?</summary><p>In „Einstellungen · Apps &amp; Widgets“ wählen Sie für jeden Desktop-Bereich Ihre Apps und Widgets aus. Diese Auswahl ändert keine Modulfreigaben.</p></details><details><summary>Entstehen durch diese Übersicht Kosten?</summary><p>Die Basisplattform kostet 0 € pro Monat. Diese Übersicht löst keine Bestellung und keine kostenpflichtige Aktivierung aus.</p></details></section>
    </div>
    <footer className="cs-platform-footer"><span>{roleLabel || 'Angemeldetes Konto'}</span><span role="status">{loading ? 'Status wird aktualisiert…' : checkedTime ? `Stand: ${checkedTime}` : 'Status abgerufen'}{data.source === 'demo' ? ' · Beispieldaten' : ''}</span></footer>
  </div>;
}
