// Generated native presentation from src/components/company/CompanyWorkspaceView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window,nativeURL as URL} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeArticle,NativeDiv,NativeSpan,NativeH3,NativeP,NativeDl,NativeDt,NativeDd,NativeFooter,NativeButton,NativeOl,NativeLi,NativeStrong,NativeTime,NativeStyle,NativeB,NativeHeader,NativeI,NativeH1,NativeImg,NativeA,NativeNav,NativeLabel,NativeInput,NativeH2,NativeSection,NativeSmall,NativeAside,NativeUl,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { COMPANY_ICON_PATHS } from './companyIconPaths';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useState, type PointerEvent } from 'react';
import type { TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import { COMPANY_TABS, activeCompanyCatalog, companyDate, companyIdentity, companySections, companySuggestions, companyWebsite, filterCompanySections, type CompanySection, type CompanyTab } from "../../lib/tenant/companyWorkspaceModel.ts";
import { companyWorkspaceCss } from "./companyWorkspaceCss.native.ts";
export function CompanyIcon({ name, size = 20 }: {
    name: string;
    size?: number;
}) {
    return <NativeWorkspaceStyleScope css={[companyWorkspaceCss]}>{<WebActionIcon size={size}><NativeSvgPath d={COMPANY_ICON_PATHS[name] ?? COMPANY_ICON_PATHS.building}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
type Props = import('./companyWorkspaceView.types').CompanyWorkspaceViewProps;
function SectionCard({ section, onOpen, canEdit }: {
    section: CompanySection;
    onOpen: Props['onOpen'];
    canEdit: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[companyWorkspaceCss]}>{<NativeArticle className="co-section" data-testid={`company-section-${section.key}`}>
    <NativeDiv className="co-section-heading"><NativeSpan className="co-icon"><CompanyIcon name={section.icon}/></NativeSpan><NativeDiv><NativeH3>{section.title}</NativeH3><NativeP>{section.description}</NativeP></NativeDiv></NativeDiv>
    {section.rows.length ? <NativeDl className="co-details">{section.rows.map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd className={!value ? 'co-unset' : undefined}>{value || 'Nicht hinterlegt'}</NativeDd></NativeDiv>)}</NativeDl> : <NativeDiv className="co-section-spacer"/>}
    <NativeFooter>{section.optional ? <NativeSpan>Bei Bedarf einrichten</NativeSpan> : <NativeSpan>Unternehmensakte</NativeSpan>}<NativeButton type="button" className="co-text-action" onClick={() => onOpen(section.key)} disabled={!canEdit}>{section.action}<CompanyIcon name="arrow" size={16}/></NativeButton></NativeFooter>
  </NativeArticle>}</NativeWorkspaceStyleScope>;
}
function Activity({ snapshot, compact = false }: {
    snapshot: TenantCenterSnapshot;
    compact?: boolean;
}) {
    const entries = [...snapshot.auditLogs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, compact ? 3 : undefined);
    if (!entries.length)
        return <NativeWorkspaceStyleScope css={[companyWorkspaceCss]}>{<NativeDiv className="co-empty co-empty--small"><CompanyIcon name="clock" size={24}/><NativeH3>Noch keine Aktivitäten protokolliert</NativeH3><NativeP>Die verfügbaren Aktivitäten Ihres Unternehmens erscheinen hier.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[companyWorkspaceCss]}>{<NativeOl className="co-activity">{entries.map(entry => <NativeLi key={entry.id}><NativeSpan className="co-activity-dot"/><NativeDiv><NativeStrong>{entry.title || 'Aktivität im Unternehmen'}</NativeStrong>{entry.description ? <NativeP>{entry.description}</NativeP> : null}<NativeTime dateTime={entry.createdAt}>{companyDate(entry.createdAt, true)}</NativeTime></NativeDiv></NativeLi>)}</NativeOl>}</NativeWorkspaceStyleScope>;
}
function moveCompanyBrand(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        return;
    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height)
        return;
    const horizontal = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const vertical = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    stage.style.setProperty('--co-brand-x', `${2 - vertical * 4}deg`);
    stage.style.setProperty('--co-brand-y', `${horizontal * 6 - 3}deg`);
    stage.style.setProperty('--co-brand-light-x', `${20 + horizontal * 60}%`);
    stage.style.setProperty('--co-brand-light-y', `${15 + vertical * 60}%`);
}
function resetCompanyBrand(event: PointerEvent<HTMLDivElement>) {
    for (const property of ['--co-brand-x', '--co-brand-y', '--co-brand-light-x', '--co-brand-light-y']) {
        event.currentTarget.style.removeProperty(property);
    }
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
    return <NativeWorkspaceStyleScope css={[companyWorkspaceCss, companyWorkspaceCss]}>{<NativeDiv className="co-workspace" data-cs-company-surface="light" data-testid="office-company-workspace">
    <NativeStyle>{companyWorkspaceCss}</NativeStyle>
    <NativeDiv className="co-topline"><NativeSpan>Office <NativeB>/</NativeB> Unternehmen</NativeSpan>{tab !== 'inventory' ? <NativeButton type="button" className="co-refresh" onClick={onRefresh} disabled={refreshing} aria-label="Unternehmensdaten aktualisieren"><CompanyIcon name="refresh" size={16}/><NativeSpan>{refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeSpan></NativeButton> : null}</NativeDiv>
    <NativeHeader className="co-hero">
      <NativeDiv className="co-hero-copy"><NativeDiv className="co-eyebrow"><NativeI />UNTERNEHMENSAKTE</NativeDiv><NativeH1>{identity.name}</NativeH1>{identity.legalName ? <NativeP className="co-legal-name">{identity.legalName}</NativeP> : null}{identity.representative ? <NativeP className="co-representative">Vertreten durch {identity.representative}</NativeP> : null}<NativeDiv className="co-hero-meta">{snapshot.company.city ? <NativeSpan><CompanyIcon name="pin" size={16}/>{snapshot.company.city}</NativeSpan> : null}{snapshot.company.legalForm ? <NativeSpan>{snapshot.company.legalForm}</NativeSpan> : null}{snapshot.register.ikNumber ? <NativeSpan>IK {snapshot.register.ikNumber}</NativeSpan> : null}</NativeDiv><NativeDiv className="co-hero-actions">{canEdit ? <NativeButton type="button" className="co-button co-button--primary" onClick={() => onOpen('company')}><CompanyIcon name="edit" size={16}/>Stammdaten bearbeiten</NativeButton> : null}<NativeButton type="button" className="co-button" onClick={() => onCopy(copyIdentity, 'Kontaktdaten kopiert.')}><CompanyIcon name="copy" size={16}/>Kontaktdaten kopieren</NativeButton></NativeDiv></NativeDiv>
      <NativeDiv className="co-brand-stage" onPointerMove={moveCompanyBrand} onPointerLeave={resetCompanyBrand} onPointerCancel={resetCompanyBrand}>
        <NativeDiv className="co-brand-halo" aria-hidden="true"/>
        <NativeDiv className="co-brand-card">
          <NativeDiv className="co-brand-logo">{logo && logoFailed !== logo ? <NativeImg src={logo} alt={`Logo ${identity.name}`} draggable={false} decoding="async" onError={() => setLogoFailed(logo)}/> : <NativeDiv className="co-brand-fallback"><CompanyIcon name="building" size={48}/><NativeStrong>{identity.initials}</NativeStrong></NativeDiv>}</NativeDiv>
        </NativeDiv>
      </NativeDiv>
    </NativeHeader>
    <NativeDiv className="co-contact-strip">{identity.email ? <NativeA href={`mailto:${encodeURIComponent(identity.email)}`}><CompanyIcon name="mail" size={16}/><NativeSpan>{identity.email}</NativeSpan></NativeA> : <NativeSpan><CompanyIcon name="mail" size={16}/>E-Mail nicht hinterlegt</NativeSpan>}{identity.phone ? <NativeA href={`tel:${identity.phone.replace(/[^\d+*#,;]/g, '')}`}><CompanyIcon name="phone" size={16}/><NativeSpan>{identity.phone}</NativeSpan></NativeA> : null}{website ? <NativeA href={website} target="_blank" rel="noopener noreferrer"><CompanyIcon name="globe" size={16}/><NativeSpan>{new URL(website).hostname}</NativeSpan></NativeA> : null}<NativeSpan className="co-area-indicator"><NativeI />{activeAreas.join(' · ')}</NativeSpan></NativeDiv>
    {notice ? <NativeDiv role="status" className={`co-notice${noticeTone === 'error' ? ' co-notice--error' : ''}`}><CompanyIcon name={noticeTone === 'error' ? 'info' : 'check'} size={20}/>{notice}</NativeDiv> : null}
    {refreshError ? <NativeDiv role="alert" className="co-notice co-notice--error"><CompanyIcon name="info"/><NativeDiv><NativeStrong>Aktualisierung fehlgeschlagen</NativeStrong><NativeP>{refreshError} Die zuletzt geladenen Angaben bleiben sichtbar.</NativeP></NativeDiv><NativeButton type="button" className="co-button" onClick={onRefresh} disabled={refreshing}>Erneut versuchen</NativeButton></NativeDiv> : null}
    <NativeDiv className="co-navigation"><NativeNav aria-label="Bereiche der Unternehmensakte">{visibleTabs.map(item => <NativeButton type="button" key={item.id} aria-pressed={!search.trim() && tab === item.id} onClick={() => navigate(item.id)}>{item.label}{item.id === 'overview' && suggestions.length ? <NativeSpan>{suggestions.length}</NativeSpan> : null}</NativeButton>)}</NativeNav>{tab !== 'inventory' ? <NativeLabel className="co-search"><CompanyIcon name="search" size={20}/><NativeSpan className="co-sr">Unternehmensbereiche durchsuchen</NativeSpan><NativeInput type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Bereich oder Angabe suchen …"/></NativeLabel> : null}</NativeDiv>
    <NativeDiv className="co-content" aria-busy={refreshing}>
      {tab === 'inventory' ? inventoryContent : search.trim() ? <><NativeDiv className="co-content-heading"><NativeDiv><NativeH2>Suchergebnisse</NativeH2><NativeP>{results.length} {results.length === 1 ? 'Bereich passt' : 'Bereiche passen'} zu „{search.trim()}“.</NativeP></NativeDiv><NativeButton type="button" className="co-text-action" onClick={() => setSearch('')}>Suche zurücksetzen<CompanyIcon name="close" size={16}/></NativeButton></NativeDiv>{results.length ? <NativeDiv className="co-grid">{results.map(section => <SectionCard key={section.key} section={section} onOpen={onOpen} canEdit={canEdit}/>)}</NativeDiv> : <NativeDiv className="co-empty"><CompanyIcon name="search" size={32}/><NativeH3>Kein passender Bereich gefunden</NativeH3><NativeP>Suchen Sie zum Beispiel nach „Bank“, „Telefon“ oder „Rechnung“.</NativeP></NativeDiv>}</> : tab === 'overview' ? <>
        <NativeDiv className="co-content-heading"><NativeDiv><NativeH2>Ihr Unternehmen im Überblick</NativeH2><NativeP>Die wichtigsten Angaben und die nächsten Schritte an einem Ort.</NativeP></NativeDiv><NativeSpan className="co-subtle">{sections.length} Bereiche</NativeSpan></NativeDiv>
        <NativeDiv className="co-overview-grid"><NativeDiv className="co-overview-main"><NativeSection className="co-panel"><NativeDiv className="co-panel-heading"><NativeSpan className="co-icon"><CompanyIcon name="building"/></NativeSpan><NativeH3>Unternehmensprofil</NativeH3><NativeButton className="co-text-action" type="button" onClick={() => navigate('identity')}>Profil öffnen<CompanyIcon name="arrow" size={16}/></NativeButton></NativeDiv><NativeDl className="co-profile-details"><NativeDiv><NativeDt>Hauptsitz</NativeDt><NativeDd>{identity.address || 'Anschrift noch nicht hinterlegt'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Geschäftsführung / Vertretung</NativeDt><NativeDd>{identity.representative || 'Noch nicht hinterlegt'}</NativeDd></NativeDiv><NativeDiv><NativeDt>E-Mail für Rechnungen</NativeDt><NativeDd>{snapshot.contact.billingEmail || 'Noch nicht hinterlegt'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Rechtsform</NativeDt><NativeDd>{snapshot.company.legalForm || 'Noch nicht hinterlegt'}</NativeDd></NativeDiv></NativeDl></NativeSection>
        <NativeDiv className="co-overview-pair"><NativeSection className="co-panel co-compact-panel"><NativeSpan className="co-icon"><CompanyIcon name="bank"/></NativeSpan><NativeH3>Abrechnung</NativeH3><NativeP>{primaryBank ? primaryBank.bankName || primaryBank.label || 'Bankverbindung hinterlegt' : 'Bankverbindungen und Rechnungsangaben einrichten.'}</NativeP><NativeDiv className="co-inline-fact"><NativeStrong>{snapshot.payment.paymentTermsDays || '—'}</NativeStrong><NativeSpan>Tage Zahlungsziel</NativeSpan></NativeDiv><NativeButton type="button" className="co-text-action" onClick={() => navigate('finance')}>Abrechnung öffnen<CompanyIcon name="arrow" size={16}/></NativeButton></NativeSection><NativeSection className="co-panel co-compact-panel"><NativeSpan className="co-icon"><CompanyIcon name="catalog"/></NativeSpan><NativeH3>Leistungen & Preise</NativeH3><NativeP>Leistungen, Fahrtkosten und Zuschläge Ihres Unternehmens.</NativeP><NativeDiv className="co-inline-fact"><NativeStrong>{activeCompanyCatalog(snapshot).length}</NativeStrong><NativeSpan>aktive Positionen</NativeSpan></NativeDiv><NativeButton type="button" className="co-text-action" disabled={!canEdit} onClick={() => onOpen('catalog')}>Katalog öffnen<CompanyIcon name="arrow" size={16}/></NativeButton></NativeSection></NativeDiv>
        {canDocuments ? <NativeButton type="button" className="co-documents" onClick={onDocuments}><NativeSpan className="co-icon"><CompanyIcon name="receipt"/></NativeSpan><NativeSpan><NativeStrong>Unternehmensdaten für Ihre Dokumente</NativeStrong><NativeSmall>Im Dokumentenkatalog stehen die hinterlegten Angaben für passende Vorlagen bereit.</NativeSmall></NativeSpan><CompanyIcon name="arrow"/></NativeButton> : null}</NativeDiv>
        <NativeAside className="co-overview-side"><NativeSection className="co-panel co-attention"><NativeDiv className="co-panel-heading"><NativeSpan className="co-icon"><CompanyIcon name={suggestions.length ? 'info' : 'check'}/></NativeSpan><NativeH3>{suggestions.length ? 'Angaben ergänzen' : 'Basisangaben hinterlegt'}</NativeH3>{suggestions.length ? <NativeSpan className="co-count">{suggestions.length}</NativeSpan> : null}</NativeDiv>{suggestions.length ? <><NativeP className="co-panel-intro">Diese Angaben können Sie als Nächstes ergänzen.</NativeP><NativeUl className="co-suggestions">{suggestions.map(item => <NativeLi key={item.id}><NativeButton type="button" onClick={() => onOpen(item.section)} disabled={!canEdit}><NativeSpan><NativeStrong>{item.title}</NativeStrong><NativeSmall>{item.description}</NativeSmall></NativeSpan><CompanyIcon name="arrow" size={16}/></NativeButton></NativeLi>)}</NativeUl></> : <NativeP className="co-panel-intro">Name, Anschrift und Erreichbarkeit sind vorhanden. Weitere Angaben ergänzen Sie nach Bedarf in den Aktenbereichen.</NativeP>}</NativeSection><NativeSection className="co-panel"><NativeDiv className="co-panel-heading"><NativeSpan className="co-icon"><CompanyIcon name="clock"/></NativeSpan><NativeH3>Letzte Aktivitäten</NativeH3></NativeDiv><Activity snapshot={snapshot} compact/><NativeButton type="button" className="co-text-action" onClick={() => navigate('history')}>Verlauf ansehen<CompanyIcon name="arrow" size={16}/></NativeButton></NativeSection></NativeAside></NativeDiv>
      </> : tab === 'history' ? <NativeSection className="co-panel"><NativeDiv className="co-content-heading"><NativeDiv><NativeH2>Aktivitäten im Unternehmen</NativeH2><NativeP>Die zuletzt verfügbaren Ereignisse Ihres Unternehmens, bereichsübergreifend.</NativeP></NativeDiv><NativeSpan className="co-subtle">{snapshot.auditLogs.length} Einträge</NativeSpan></NativeDiv><Activity snapshot={snapshot}/></NativeSection> : <><NativeDiv className="co-content-heading"><NativeDiv><NativeH2>{COMPANY_TABS.find(item => item.id === tab)?.label}</NativeH2><NativeP>{tab === 'identity' ? 'Stammdaten, Kontakt und die Menschen, die Ihr Unternehmen vertreten.' : tab === 'compliance' ? 'Hinterlegen Sie die für Ihr Unternehmen zutreffenden Angaben.' : tab === 'finance' ? 'Bankverbindungen, Zahlungsbedingungen und Leistungsvorgaben.' : 'Leistungsbereiche, eigene Angaben und Datenverwaltung.'}</NativeP></NativeDiv></NativeDiv><NativeDiv className="co-grid">{results.map(section => <SectionCard key={section.key} section={section} onOpen={onOpen} canEdit={canEdit}/>)}</NativeDiv>{tab === 'organization' && snapshot.customFields.length ? <NativeSection className="co-panel co-custom-list"><NativeDiv className="co-panel-heading"><NativeSpan className="co-icon"><CompanyIcon name="sliders"/></NativeSpan><NativeH3>Ihre Felddefinitionen</NativeH3></NativeDiv>{snapshot.customFields.map(field => <NativeDiv className="co-custom-row" key={field.id ?? field.fieldKey}><NativeDiv><NativeStrong>{field.label || field.fieldKey}</NativeStrong><NativeSmall>{({ text: 'Text', multiline: 'Mehrzeiliger Text', number: 'Zahl', date: 'Datum', boolean: 'Ja / Nein', select: 'Auswahl' })[field.dataType]} · {field.isActive ? 'Aktiv' : 'Inaktiv'}</NativeSmall></NativeDiv><NativeButton type="button" className="co-text-action" onClick={() => onCustomField(field)} disabled={!canEdit}>Bearbeiten<CompanyIcon name="edit" size={16}/></NativeButton></NativeDiv>)}</NativeSection> : null}{tab === 'organization' ? settingsContent : null}</>}
    </NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
