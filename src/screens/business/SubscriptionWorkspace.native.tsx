// Generated native presentation from src/screens/business/SubscriptionWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeStyle,NativeHeader,NativeP,NativeH1,NativeSpan,NativeButton,NativeStrong,NativeSection,NativeH2,NativeLabel,NativeInput,NativeArticle,NativeH3,NativeDetails,NativeSummary,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../components/icons/WebActionIcon.native.tsx";
import { useId, useState } from 'react';
import type { ProductKey } from '@/types';
import type { SubscriptionWorkspaceSnapshot } from "../../lib/business/subscriptionWorkspaceService.native.ts";
import { DesktopCatalogArtwork } from "../../liquid-command/components/DesktopCatalogArtwork.tsx";
import { DesktopCatalogIcon } from "../../liquid-command/components/DesktopCatalogIcon.native.tsx";
import { SUBSCRIPTION_WORKSPACE_CSS } from "./subscriptionWorkspaceCss.native.ts";
const PRODUCTS: Record<ProductKey, {
    name: string;
    description: string;
    route: string;
    tone: string;
}> = {
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
function ActionIcon({ kind }: {
    kind: 'refresh' | 'arrow' | 'check' | 'search' | 'info';
}) {
    const paths = {
        refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
        arrow: 'M4 12h16m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6',
        search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
        info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6M12 7h.01',
    };
    return <NativeWorkspaceStyleScope css={[SUBSCRIPTION_WORKSPACE_CSS]}>{<WebActionIcon><NativeSvgPath d={paths[kind]}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
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
    return <NativeWorkspaceStyleScope css={[SUBSCRIPTION_WORKSPACE_CSS, SUBSCRIPTION_WORKSPACE_CSS]}>{<NativeDiv className="cs-platform" data-testid="subscription-workspace">
    <NativeStyle>{SUBSCRIPTION_WORKSPACE_CSS}</NativeStyle>
    <NativeHeader className="cs-platform-heading">
      <NativeDiv><NativeP className="cs-platform-eyebrow">Ihr CareSuite+</NativeP><NativeH1>Plattform &amp; Module</NativeH1><NativeP className="cs-platform-tenant">{data.tenantName}{data.source === 'demo' ? <NativeSpan className="cs-platform-demo">Demo</NativeSpan> : null}</NativeP></NativeDiv>
      <NativeButton type="button" className="cs-platform-button cs-platform-button--quiet" onClick={onRefresh} disabled={loading}><ActionIcon kind="refresh"/>{loading ? 'Wird aktualisiert…' : 'Aktualisieren'}</NativeButton>
    </NativeHeader>

    {error ? <NativeDiv className="cs-platform-feedback" role="alert"><ActionIcon kind="info"/><NativeDiv><NativeStrong>Aktualisierung fehlgeschlagen</NativeStrong><NativeP>{error} Die angezeigten Angaben stammen vom letzten erfolgreichen Abruf. Bitte erneut aktualisieren.</NativeP></NativeDiv></NativeDiv> : null}
    <NativeSection className="cs-platform-plan" aria-labelledby={`${id}-plan`}>
      <NativeDiv className="cs-platform-plan-intro">
        <NativeDiv className="cs-platform-plan-art"><DesktopCatalogArtwork route="/office" label="CareSuite+" size={76}/></NativeDiv>
        <NativeDiv><NativeSpan className="cs-platform-badge cs-platform-badge--active"><ActionIcon kind="check"/>Dauerhaft kostenlos</NativeSpan><NativeH2 id={`${id}-plan`}>Raum für Ihre tägliche Arbeit.</NativeH2><NativeP>Die CareSuite+ Basisplattform für Ihr Unternehmen.</NativeP></NativeDiv>
      </NativeDiv>
      <NativeDiv className="cs-platform-price"><NativeSpan><NativeStrong>0 €</NativeStrong> / Monat</NativeSpan><NativeP>Keine Kreditkarte · Keine Testphase</NativeP></NativeDiv>
      <NativeDiv className="cs-platform-plan-facts">
        <NativeDiv><NativeStrong>{data.activeModuleCount}<NativeSpan> / {data.totalModuleCount}</NativeSpan></NativeStrong><NativeP>Module freigeschaltet</NativeP></NativeDiv>
        <NativeDiv><NativeStrong>{data.platformFeatureCount}</NativeStrong><NativeP>Plattform-Funktionen enthalten</NativeP></NativeDiv>
        <NativeDiv className="cs-platform-plan-explanation"><ActionIcon kind="info"/><NativeP>Freigaben und Ihre Rolle bestimmen, welche Bereiche Sie nutzen können.</NativeP></NativeDiv>
      </NativeDiv>
    </NativeSection>

    <NativeSection className="cs-platform-modules" aria-labelledby={`${id}-modules`}>
      <NativeDiv className="cs-platform-section-heading"><NativeDiv><NativeH2 id={`${id}-modules`}>Ihre Module</NativeH2><NativeP>Alle Hauptmodule gehören zum kostenlosen Plattformumfang.</NativeP></NativeDiv>{onOpenApps ? <NativeButton type="button" className="cs-platform-button cs-platform-button--primary" disabled={disabled} onClick={onOpenApps}>Apps &amp; Widgets<ActionIcon kind="arrow"/></NativeButton> : null}</NativeDiv>
      <NativeDiv className="cs-platform-toolbar">
        <NativeDiv className="cs-platform-filters" role="group" aria-label="Module filtern">
          {([{ value: 'all', label: 'Alle', count: data.totalModuleCount }, { value: 'active', label: 'Freigeschaltet', count: data.activeModuleCount }, { value: 'unavailable', label: 'Weitere', count: data.totalModuleCount - data.activeModuleCount }] as const).map((item) => <NativeButton key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<NativeSpan>{item.count}</NativeSpan></NativeButton>)}
        </NativeDiv>
        <NativeLabel className="cs-platform-search"><ActionIcon kind="search"/><NativeSpan className="cs-platform-sr">Module durchsuchen</NativeSpan><NativeInput type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Modul suchen…"/></NativeLabel>
      </NativeDiv>
      <NativeP className="cs-platform-sr" role="status">{filtered.length} {filtered.length === 1 ? 'Modul gefunden' : 'Module gefunden'}</NativeP>
      {filtered.length ? <NativeDiv className="cs-platform-grid">{filtered.map((module) => {
                const product = PRODUCTS[module.key];
                const action = module.status === 'active' ? moduleActions[module.key] : undefined;
                return <NativeWorkspaceStyleScope css={[SUBSCRIPTION_WORKSPACE_CSS]}>{<NativeArticle className={`cs-platform-module cs-platform-module--${product.tone}`} key={module.key}>
          <NativeDiv className="cs-platform-module-top"><NativeDiv className="cs-platform-module-art"><DesktopCatalogArtwork route={product.route} label={product.name} size={60}/></NativeDiv><NativeSpan className={`cs-platform-badge cs-platform-badge--${module.status}`}>{STATE_LABELS[module.status]}</NativeSpan></NativeDiv>
          <NativeH3>CareSuite+ {product.name}</NativeH3><NativeP className="cs-platform-description">{product.description}</NativeP>
          <NativeDiv className="cs-platform-module-bottom"><NativeP className="cs-platform-reason">{module.reason}</NativeP>{action ? <NativeButton type="button" className="cs-platform-open" disabled={disabled} onClick={action} aria-label={`${product.name} öffnen`}>Öffnen<ActionIcon kind="arrow"/></NativeButton> : module.status === 'active' ? <NativeP className="cs-platform-access-note">Für Ihre Rolle ist hier kein direkter Zugang verfügbar.</NativeP> : null}</NativeDiv>
        </NativeArticle>}</NativeWorkspaceStyleScope>;
            })}</NativeDiv> : <NativeDiv className="cs-platform-empty"><DesktopCatalogIcon route="/settings/apps-widgets" size={32}/><NativeH3>Keine passenden Module</NativeH3><NativeP>Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.</NativeP><NativeButton type="button" className="cs-platform-button" onClick={() => { setQuery(''); setFilter('all'); }}>Filter zurücksetzen</NativeButton></NativeDiv>}
    </NativeSection>

    <NativeSection className="cs-platform-features" aria-labelledby={`${id}-features`}>
      <NativeDiv className="cs-platform-section-heading"><NativeDiv><NativeH2 id={`${id}-features`}>Im Plattformumfang enthalten</NativeH2><NativeP>Diese Funktionen ergänzen die Hauptmodule. Der Zugang richtet sich nach Freigaben und Berechtigungen.</NativeP></NativeDiv></NativeDiv>
      <NativeDiv className="cs-platform-feature-grid">{FEATURES.map((feature) => <NativeDiv className="cs-platform-feature" key={feature.name}><NativeSpan className="cs-platform-feature-icon"><DesktopCatalogIcon route={feature.route} size={24}/></NativeSpan><NativeDiv><NativeH3>{feature.name}</NativeH3><NativeP>{feature.description}</NativeP></NativeDiv></NativeDiv>)}</NativeDiv>
    </NativeSection>

    <NativeDiv className="cs-platform-bottom-grid">
      <NativeSection className="cs-platform-connections" aria-labelledby={`${id}-connections`}><NativeSpan className="cs-platform-feature-icon cs-platform-feature-icon--violet"><DesktopCatalogIcon route="/business/connect" size={24}/></NativeSpan><NativeH2 id={`${id}-connections`}>Externe Anbindungen</NativeH2><NativeP>DATEV, KIM, TI-Anbindung und E-Rezept sind als zusätzliche Dienste vorgesehen. Hier können sie noch nicht gebucht oder aktiviert werden.</NativeP><NativeSpan className="cs-platform-badge cs-platform-badge--prepared">In Vorbereitung</NativeSpan></NativeSection>
      <NativeSection className="cs-platform-faq" aria-labelledby={`${id}-faq`}><NativeH2 id={`${id}-faq`}>Gut zu wissen</NativeH2><NativeDetails><NativeSummary>Warum sind nicht alle Module freigeschaltet?</NativeSummary><NativeP>Kostenlos enthalten bedeutet nicht automatisch freigegeben. Modulstatus, technische Verfügbarkeit und Ihre Berechtigungen bestimmen den Zugang. Die jeweilige Modulkarte zeigt den aktuellen Stand.</NativeP></NativeDetails><NativeDetails><NativeSummary>Wo passe ich meinen Desktop an?</NativeSummary><NativeP>In „Einstellungen · Apps &amp; Widgets“ wählen Sie für jeden Desktop-Bereich Ihre Apps und Widgets aus. Diese Auswahl ändert keine Modulfreigaben.</NativeP></NativeDetails><NativeDetails><NativeSummary>Entstehen durch diese Übersicht Kosten?</NativeSummary><NativeP>Die Basisplattform kostet 0 € pro Monat. Diese Übersicht löst keine Bestellung und keine kostenpflichtige Aktivierung aus.</NativeP></NativeDetails></NativeSection>
    </NativeDiv>
    <NativeFooter className="cs-platform-footer"><NativeSpan>{roleLabel || 'Angemeldetes Konto'}</NativeSpan><NativeSpan role="status">{loading ? 'Status wird aktualisiert…' : checkedTime ? `Stand: ${checkedTime}` : 'Status abgerufen'}{data.source === 'demo' ? ' · Beispieldaten' : ''}</NativeSpan></NativeFooter>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
