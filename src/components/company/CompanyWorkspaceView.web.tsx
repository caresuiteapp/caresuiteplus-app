import { useState, type ReactNode } from 'react';
import type { TenantCenterSectionKey, TenantCenterSnapshot, TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import { COMPANY_TABS, activeCompanyCatalog, companyDate, companyIdentity, companySections, companySuggestions, companyWebsite, filterCompanySections, type CompanySection, type CompanyTab } from '@/lib/tenant/companyWorkspaceModel.web';
import { companyWorkspaceCss } from './companyWorkspaceCss.web';

export function CompanyIcon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    building: 'M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7v2m0 3v2m0 3v2m9-8v2m0 3v2',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7', phone: 'M7 3H4v4c0 7 6 13 13 13h4v-4l-5-2-2 3a13 13 0 0 1-7-7l3-2z',
    pin: 'M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12zM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    edit: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z', arrow: 'M5 12h14m-5-5 5 5-5 5',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6', close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6', copy: 'M9 8h11v13H9zM5 16H3V3h12v2',
    people: 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3a5 5 0 0 1 3 5',
    shield: 'm12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6zM8 12l3 3 5-6',
    certificate: 'M5 3h14v12H5zM8 7h8M8 11h5M8 15v6l4-2 4 2v-6',
    receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8M8 15h4',
    bank: 'm3 8 9-5 9 5zM5 10v8m5-8v8m4-8v8m5-8v8M3 21h18',
    catalog: 'M4 3h15v18H4zM8 3v18M11 7h5M11 11h5M11 15h4',
    car: 'm4 9 2-5h12l2 5M3 10h18v8H3zM5 18v3m14-3v3M6 13h2m8 0h2',
    wallet: 'M3 5h17v15H3zM15 10h7v6h-7zM18 13h1',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    sliders: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6',
    transfer: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
    image: 'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M8 6h1',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l4 2',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18',
    plus: 'M12 4v16M4 12h16', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6m0-10v1',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.building} /></svg>;
}

type Props = {
  snapshot: TenantCenterSnapshot;
  tab: CompanyTab;
  onTab: (tab: CompanyTab) => void;
  activeAreas: readonly string[];
  canEdit: boolean;
  canDocuments: boolean;
  canInventory?: boolean;
  inventoryContent?: ReactNode;
  settingsContent?: ReactNode;
  refreshing: boolean;
  refreshError?: string | null;
  notice?: string | null;
  noticeTone?: 'success' | 'error';
  onRefresh: () => void;
  onOpen: (key: TenantCenterSectionKey) => void;
  onCustomField: (field: TenantCustomFieldDefinition) => void;
  onCopy: (value: string, description: string) => void;
  onDocuments: () => void;
};

function SectionCard({ section, onOpen, canEdit }: { section: CompanySection; onOpen: Props['onOpen']; canEdit: boolean }) {
  return <article className="co-section" data-testid={`company-section-${section.key}`}>
    <div className="co-section-heading"><span className="co-icon"><CompanyIcon name={section.icon} /></span><div><h3>{section.title}</h3><p>{section.description}</p></div></div>
    {section.rows.length ? <dl className="co-details">{section.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value ? 'co-unset' : undefined}>{value || 'Nicht hinterlegt'}</dd></div>)}</dl> : <div className="co-section-spacer" />}
    <footer>{section.optional ? <span>Bei Bedarf einrichten</span> : <span>Unternehmensakte</span>}<button type="button" className="co-text-action" onClick={() => onOpen(section.key)} disabled={!canEdit}>{section.action}<CompanyIcon name="arrow" size={17} /></button></footer>
  </article>;
}

function Activity({ snapshot, compact = false }: { snapshot: TenantCenterSnapshot; compact?: boolean }) {
  const entries = [...snapshot.auditLogs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, compact ? 3 : undefined);
  if (!entries.length) return <div className="co-empty co-empty--small"><CompanyIcon name="clock" size={26} /><h3>Noch keine Aktivitäten protokolliert</h3><p>Die verfügbaren Aktivitäten Ihres Unternehmens erscheinen hier.</p></div>;
  return <ol className="co-activity">{entries.map(entry => <li key={entry.id}><span className="co-activity-dot" /><div><strong>{entry.title || 'Aktivität im Unternehmen'}</strong>{entry.description ? <p>{entry.description}</p> : null}<time dateTime={entry.createdAt}>{companyDate(entry.createdAt, true)}</time></div></li>)}</ol>;
}

export function CompanyWorkspaceView({ snapshot, tab, onTab, activeAreas, canEdit, canDocuments, canInventory = false, inventoryContent, settingsContent, refreshing, refreshError, notice, noticeTone = 'success', onRefresh, onOpen, onCustomField, onCopy, onDocuments }: Props) {
  const [search, setSearch] = useState('');
  const identity = companyIdentity(snapshot);
  const sections = companySections(snapshot, activeAreas);
  const suggestions = companySuggestions(snapshot);
  const website = companyWebsite(snapshot.company.website);
  const logo = companyWebsite(snapshot.branding.logoUrl);
  const [logoFailed, setLogoFailed] = useState<string | null>(null);
  const results = search.trim() ? filterCompanySections(sections, search) : sections.filter(section => section.tab === tab);
  const primaryBank = snapshot.bankAccounts.find(account => account.isPrimary) ?? snapshot.bankAccounts[0];
  const copyIdentity = [identity.name, identity.legalName, identity.address, identity.email, identity.phone, snapshot.company.website].filter(Boolean).join('\n');
  const navigate = (next: CompanyTab) => { setSearch(''); onTab(next); };
  const visibleTabs = COMPANY_TABS.filter(item => item.id !== 'inventory' || canInventory);
  return <div className="co-workspace" data-cs-company-surface="light" data-testid="office-company-workspace">
    <style>{companyWorkspaceCss}</style>
    <div className="co-topline"><span>Office <b>/</b> Unternehmen</span>{tab !== 'inventory' ? <button type="button" className="co-refresh" onClick={onRefresh} disabled={refreshing} aria-label="Unternehmensdaten aktualisieren"><CompanyIcon name="refresh" size={16} /><span>{refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</span></button> : null}</div>
    <header className="co-hero">
      <div className="co-hero-copy"><div className="co-eyebrow"><i />UNTERNEHMENSAKTE</div><h1>{identity.name}</h1>{identity.legalName ? <p className="co-legal-name">{identity.legalName}</p> : null}{identity.representative ? <p className="co-representative">Vertreten durch {identity.representative}</p> : null}<div className="co-hero-meta">{snapshot.company.city ? <span><CompanyIcon name="pin" size={16} />{snapshot.company.city}</span> : null}{snapshot.company.legalForm ? <span>{snapshot.company.legalForm}</span> : null}{snapshot.register.ikNumber ? <span>IK {snapshot.register.ikNumber}</span> : null}</div><div className="co-hero-actions">{canEdit ? <button type="button" className="co-button co-button--primary" onClick={() => onOpen('company')}><CompanyIcon name="edit" size={17} />Stammdaten bearbeiten</button> : null}<button type="button" className="co-button" onClick={() => onCopy(copyIdentity, 'Kontaktdaten kopiert.')}><CompanyIcon name="copy" size={17} />Kontaktdaten kopieren</button></div></div>
      <div className="co-brand-stage"><div className="co-brand-halo" /><div className="co-brand-card">{logo && logoFailed !== logo ? <img src={logo} alt={`Logo ${identity.name}`} onError={() => setLogoFailed(logo)} /> : <><CompanyIcon name="building" size={42} /><strong>{identity.initials}</strong></>}<span>UNTERNEHMEN</span></div></div>
    </header>
    <div className="co-contact-strip">{identity.email ? <a href={`mailto:${encodeURIComponent(identity.email)}`}><CompanyIcon name="mail" size={17} /><span>{identity.email}</span></a> : <span><CompanyIcon name="mail" size={17} />E-Mail nicht hinterlegt</span>}{identity.phone ? <a href={`tel:${identity.phone.replace(/[^\d+*#,;]/g, '')}`}><CompanyIcon name="phone" size={17} /><span>{identity.phone}</span></a> : null}{website ? <a href={website} target="_blank" rel="noopener noreferrer"><CompanyIcon name="globe" size={17} /><span>{new URL(website).hostname}</span></a> : null}<span className="co-area-indicator"><i />{activeAreas.join(' · ')}</span></div>
    {notice ? <div role="status" className={`co-notice${noticeTone === 'error' ? ' co-notice--error' : ''}`}><CompanyIcon name={noticeTone === 'error' ? 'info' : 'check'} size={18} />{notice}</div> : null}
    {refreshError ? <div role="alert" className="co-notice co-notice--error"><CompanyIcon name="info" /><div><strong>Aktualisierung fehlgeschlagen</strong><p>{refreshError} Die zuletzt geladenen Angaben bleiben sichtbar.</p></div><button type="button" className="co-button" onClick={onRefresh} disabled={refreshing}>Erneut versuchen</button></div> : null}
    <div className="co-navigation"><nav aria-label="Bereiche der Unternehmensakte">{visibleTabs.map(item => <button type="button" key={item.id} aria-pressed={!search.trim() && tab === item.id} onClick={() => navigate(item.id)}>{item.label}{item.id === 'overview' && suggestions.length ? <span>{suggestions.length}</span> : null}</button>)}</nav>{tab !== 'inventory' ? <label className="co-search"><CompanyIcon name="search" size={18} /><span className="co-sr">Unternehmensbereiche durchsuchen</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Bereich oder Angabe suchen …" /></label> : null}</div>
    <div className="co-content" aria-busy={refreshing}>
      {tab === 'inventory' ? inventoryContent : search.trim() ? <><div className="co-content-heading"><div><h2>Suchergebnisse</h2><p>{results.length} {results.length === 1 ? 'Bereich passt' : 'Bereiche passen'} zu „{search.trim()}“.</p></div><button type="button" className="co-text-action" onClick={() => setSearch('')}>Suche zurücksetzen<CompanyIcon name="close" size={17} /></button></div>{results.length ? <div className="co-grid">{results.map(section => <SectionCard key={section.key} section={section} onOpen={onOpen} canEdit={canEdit} />)}</div> : <div className="co-empty"><CompanyIcon name="search" size={30} /><h3>Kein passender Bereich gefunden</h3><p>Suchen Sie zum Beispiel nach „Bank“, „Telefon“ oder „Rechnung“.</p></div>}</> : tab === 'overview' ? <>
        <div className="co-content-heading"><div><h2>Ihr Unternehmen im Überblick</h2><p>Die wichtigsten Angaben und die nächsten Schritte an einem Ort.</p></div><span className="co-subtle">{sections.length} Bereiche</span></div>
        <div className="co-overview-grid"><div className="co-overview-main"><section className="co-panel"><div className="co-panel-heading"><span className="co-icon"><CompanyIcon name="building" /></span><h3>Unternehmensprofil</h3><button className="co-text-action" type="button" onClick={() => navigate('identity')}>Profil öffnen<CompanyIcon name="arrow" size={16} /></button></div><dl className="co-profile-details"><div><dt>Hauptsitz</dt><dd>{identity.address || 'Anschrift noch nicht hinterlegt'}</dd></div><div><dt>Geschäftsführung / Vertretung</dt><dd>{identity.representative || 'Noch nicht hinterlegt'}</dd></div><div><dt>E-Mail für Rechnungen</dt><dd>{snapshot.contact.billingEmail || 'Noch nicht hinterlegt'}</dd></div><div><dt>Rechtsform</dt><dd>{snapshot.company.legalForm || 'Noch nicht hinterlegt'}</dd></div></dl></section>
        <div className="co-overview-pair"><section className="co-panel co-compact-panel"><span className="co-icon"><CompanyIcon name="bank" /></span><h3>Abrechnung</h3><p>{primaryBank ? primaryBank.bankName || primaryBank.label || 'Bankverbindung hinterlegt' : 'Bankverbindungen und Rechnungsangaben einrichten.'}</p><div className="co-inline-fact"><strong>{snapshot.payment.paymentTermsDays || '—'}</strong><span>Tage Zahlungsziel</span></div><button type="button" className="co-text-action" onClick={() => navigate('finance')}>Abrechnung öffnen<CompanyIcon name="arrow" size={17} /></button></section><section className="co-panel co-compact-panel"><span className="co-icon"><CompanyIcon name="catalog" /></span><h3>Leistungen & Preise</h3><p>Leistungen, Fahrtkosten und Zuschläge Ihres Unternehmens.</p><div className="co-inline-fact"><strong>{activeCompanyCatalog(snapshot).length}</strong><span>aktive Positionen</span></div><button type="button" className="co-text-action" disabled={!canEdit} onClick={() => onOpen('catalog')}>Katalog öffnen<CompanyIcon name="arrow" size={17} /></button></section></div>
        {canDocuments ? <button type="button" className="co-documents" onClick={onDocuments}><span className="co-icon"><CompanyIcon name="receipt" /></span><span><strong>Unternehmensdaten für Ihre Dokumente</strong><small>Im Dokumentenkatalog stehen die hinterlegten Angaben für passende Vorlagen bereit.</small></span><CompanyIcon name="arrow" /></button> : null}</div>
        <aside className="co-overview-side"><section className="co-panel co-attention"><div className="co-panel-heading"><span className="co-icon"><CompanyIcon name={suggestions.length ? 'info' : 'check'} /></span><h3>{suggestions.length ? 'Angaben ergänzen' : 'Basisangaben hinterlegt'}</h3>{suggestions.length ? <span className="co-count">{suggestions.length}</span> : null}</div>{suggestions.length ? <><p className="co-panel-intro">Diese Angaben können Sie als Nächstes ergänzen.</p><ul className="co-suggestions">{suggestions.map(item => <li key={item.id}><button type="button" onClick={() => onOpen(item.section)} disabled={!canEdit}><span><strong>{item.title}</strong><small>{item.description}</small></span><CompanyIcon name="arrow" size={17} /></button></li>)}</ul></> : <p className="co-panel-intro">Name, Anschrift und Erreichbarkeit sind vorhanden. Weitere Angaben ergänzen Sie nach Bedarf in den Aktenbereichen.</p>}</section><section className="co-panel"><div className="co-panel-heading"><span className="co-icon"><CompanyIcon name="clock" /></span><h3>Letzte Aktivitäten</h3></div><Activity snapshot={snapshot} compact /><button type="button" className="co-text-action" onClick={() => navigate('history')}>Verlauf ansehen<CompanyIcon name="arrow" size={17} /></button></section></aside></div>
      </> : tab === 'history' ? <section className="co-panel"><div className="co-content-heading"><div><h2>Aktivitäten im Unternehmen</h2><p>Die zuletzt verfügbaren Ereignisse Ihres Unternehmens, bereichsübergreifend.</p></div><span className="co-subtle">{snapshot.auditLogs.length} Einträge</span></div><Activity snapshot={snapshot} /></section> : <><div className="co-content-heading"><div><h2>{COMPANY_TABS.find(item => item.id === tab)?.label}</h2><p>{tab === 'identity' ? 'Stammdaten, Kontakt und die Menschen, die Ihr Unternehmen vertreten.' : tab === 'compliance' ? 'Hinterlegen Sie die für Ihr Unternehmen zutreffenden Angaben.' : tab === 'finance' ? 'Bankverbindungen, Zahlungsbedingungen und Leistungsvorgaben.' : 'Leistungsbereiche, eigene Angaben und Datenverwaltung.'}</p></div></div><div className="co-grid">{results.map(section => <SectionCard key={section.key} section={section} onOpen={onOpen} canEdit={canEdit} />)}</div>{tab === 'organization' && snapshot.customFields.length ? <section className="co-panel co-custom-list"><div className="co-panel-heading"><span className="co-icon"><CompanyIcon name="sliders" /></span><h3>Ihre Felddefinitionen</h3></div>{snapshot.customFields.map(field => <div className="co-custom-row" key={field.id ?? field.fieldKey}><div><strong>{field.label || field.fieldKey}</strong><small>{({ text: 'Text', multiline: 'Mehrzeiliger Text', number: 'Zahl', date: 'Datum', boolean: 'Ja / Nein', select: 'Auswahl' })[field.dataType]} · {field.isActive ? 'Aktiv' : 'Inaktiv'}</small></div><button type="button" className="co-text-action" onClick={() => onCustomField(field)} disabled={!canEdit}>Bearbeiten<CompanyIcon name="edit" size={16} /></button></div>)}</section> : null}{tab === 'organization' ? settingsContent : null}</>}
    </div>
  </div>;
}
