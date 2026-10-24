// Generated native presentation from src/screens/qm/QmDashboardScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeSection,NativeHeader,NativeDiv,NativeP,NativeH1,NativeButton,NativeStrong,NativeSpan,NativeSmall,NativeH2,NativeDetails,NativeSummary,NativeH3,NativeUl,NativeLi,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { qmWorkspaceCss } from "../../components/qm/qmWorkspaceCss.native.ts";
import { DesktopCatalogArtwork } from "../../liquid-command/components/DesktopCatalogArtwork.tsx";
import { useQmDashboard } from '@/hooks/qm';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';
import type { QmDashboardSnapshot } from '@/lib/qm/qm.types';
const QM_ROOT = '/business/office/qm';
const SHORTCUTS = [
    { id: 'handbook', title: 'QM-Handbuch', description: 'Kapitel, Standards und gespeicherte Fassungen an einem Ort.', path: 'handbook', artwork: '/akademie/mediathek' },
    { id: 'documents', title: 'QM-Dokumente', description: 'Unterlagen finden, Fassungen lesen und Lesebestätigungen prüfen.', path: 'documents', artwork: '/business/office/documents' },
    { id: 'templates', title: 'QM-Vorlagen', description: 'Passende Vorlagen für die eigene Qualitätsarbeit auswählen.', path: 'templates', artwork: '/business/office/document-catalog' },
] as const;
const REGISTERS = [
    { title: 'Audits', description: 'Termine, Prüfer und Feststellungen', path: 'audits', icon: 'search' },
    { title: 'Maßnahmen', description: 'Verantwortung, Fristen und Status', path: 'measures', icon: 'list' },
    { title: 'Compliance', description: 'Anforderungen und hinterlegte Nachweise', path: 'compliance', icon: 'check' },
    { title: 'MD-Prüfung', description: 'Vorhandene Prüfmappen einsehen', path: 'md-audit', icon: 'layers' },
    { title: 'Änderungen', description: 'Korrekturen und Verbesserungen verfolgen', path: 'changes', icon: 'edit' },
    { title: 'Rechtsgrundlagen', description: 'Hinterlegte Quellen und Zuordnungen', path: 'legal-references', icon: 'book' },
] as const;
const KPI_TARGETS = [
    { field: 'chapterCount', section: 'chapters', path: 'handbook', icon: 'book' },
    { field: 'documentCount', section: 'documents', path: 'documents', icon: 'layers' },
    { field: 'complianceOpenCount', section: 'compliance', path: 'compliance', icon: 'check' },
    { field: 'mdPackageCount', section: 'mdPackages', path: 'md-audit', icon: 'search' },
    { field: 'pendingApprovals', section: 'approvals', path: 'documents?status=in_review', icon: 'list' },
] as const;
const SPECIALIST_AREAS = [
    { id: 'quality', title: 'Qualitätsvorgänge', description: 'Qualitätsvorgänge erfassen, prüfen und nachvollziehbar berichtigen.', icon: 'layers' },
    { id: 'complaints', title: 'Beschwerden', description: 'Anliegen, Untersuchungen, Rückmeldungen und Ergebnisse zusammenführen.', icon: 'list' },
    { id: 'safety', title: 'Fehler & Risiken', description: 'Sicherheitsereignisse mit Zuständigkeit und Nachweisen bearbeiten.', icon: 'alert' },
    { id: 'falls', title: 'Sturz- und Ereignisanalyse', description: 'Ereignisursachen, Versorgungsanpassungen und Wiederholungsprüfungen dokumentieren.', icon: 'search' },
    { id: 'follow-up', title: 'Wirksamkeitsprüfung', description: 'Durchgeführte Maßnahmen und ihre tatsächliche Wirkung getrennt bewerten.', icon: 'check' },
    { id: 'acceptance', title: 'Pflegefachliche Abnahme', description: 'Fachliche Entscheidungen und dokumentierte Einschränkungen nachvollziehen.', icon: 'book' },
] as const;
type SpecialistId = typeof SPECIALIST_AREAS[number]['id'];
function dateParts(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return null;
    return {
        day: new Intl.DateTimeFormat('de-DE', { day: '2-digit', timeZone: 'Europe/Berlin' }).format(date),
        month: new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'Europe/Berlin' }).format(date),
        full: new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(date),
    };
}
/** Only available QM registers load on entry. Prepared clinical workflows never mount here. */
export function QmDashboardScreen() {
    const router = useRouter();
    const query = useQmDashboard();
    const [activeSpecialist, setActiveSpecialist] = useState<SpecialistId | null>(null);
    const specialistHeading = useRef<HTMLHeadingElement>(null);
    const data = query.data;
    const busy = query.loading || query.refreshing;
    const error = query.error ?? query.refreshError;
    const partial = data && Object.values(data.sectionErrors ?? {}).some(Boolean);
    const kpis = data ? buildQmDashboardKpis(data) : null;
    const specialist = SPECIALIST_AREAS.find(area => area.id === activeSpecialist);
    const loadedAt = data?.loadedAt ? dateParts(data.loadedAt) : null;
    const open = (path: string) => router.push(`${QM_ROOT}/${path}` as never);
    useEffect(() => { if (activeSpecialist)
        specialistHeading.current?.focus({ preventScroll: true }); }, [activeSpecialist]);
    return <NativeWorkspaceStyleScope css={[qmWorkspaceCss, qmWorkspaceCss]}>{<ScreenShell title="Qualitätsmanagement" contentOwnsHeader>
    <NativeStyle>{qmWorkspaceCss}</NativeStyle>
    <NativeSection className="qm-workspace" data-testid="qm-dashboard-workspace" aria-label="Qualitätsmanagement">
      <NativeHeader className="qm-header">
        <NativeDiv className="qm-heading">
          <DesktopCatalogArtwork route="/business/audit-log" label="Qualitätsmanagement" size={86} style={{ alignSelf: 'flex-end' }}/>
          <NativeDiv><NativeP className="qm-eyebrow">Office · Übersicht</NativeP><NativeH1>Qualitätsmanagement</NativeH1><NativeP>Handbuch, Dokumente und Prüfstände gemeinsam überblicken.</NativeP></NativeDiv>
        </NativeDiv>
        <NativeDiv className="qm-actions"><NativeButton type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}><CatalogIcon kind="refresh"/>{busy ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton><NativeButton type="button" className="qm-button qm-button--primary" onClick={() => open('documents')}><CatalogIcon kind="layers"/>Dokumente ansehen</NativeButton></NativeDiv>
      </NativeHeader>

      {error ? <NativeDiv className="qm-notice" data-tone="error" role="alert"><NativeDiv><NativeStrong>{data ? 'Aktualisierung nicht vollständig' : 'Übersicht konnte nicht geladen werden'}</NativeStrong><NativeP>{error}</NativeP>{data ? <NativeP>Die verfügbaren Werte zeigen den letzten erfolgreichen Stand.</NativeP> : <NativeP>Nicht geladene Werte werden nicht als 0 angezeigt.</NativeP>}</NativeDiv><NativeButton type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {partial ? <NativeDiv className="qm-notice" data-tone="warning" role="status"><NativeDiv><NativeStrong>Einzelne Bereiche konnten nicht geladen werden.</NativeStrong><NativeP>Diese Kennzahlen sind mit „—“ gekennzeichnet. Die verfügbaren Bereiche können Sie weiter öffnen.</NativeP></NativeDiv><NativeButton type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}>Fehlende Daten erneut laden</NativeButton></NativeDiv> : null}

      <NativeSection aria-label="QM-Kennzahlen" className="qm-stack" aria-busy={busy}>
        <NativeDiv className="qm-data-status"><NativeStrong>Aktueller Überblick</NativeStrong><NativeSpan>{busy ? 'Daten werden geladen …' : data ? `Gespeicherte QM-Daten${loadedAt ? ` · Stand ${loadedAt.full}, ${new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(data.loadedAt!))} Uhr` : ''}` : 'Noch kein bestätigter Datenstand'}</NativeSpan></NativeDiv>
        <NativeDiv className="qm-kpis">{KPI_TARGETS.map((target, index) => {
            const kpi = kpis?.[index];
            const labels = ['Kapitel', 'Dokumente', 'Compliance offen', 'MD-Mappen', 'Freigaben offen'];
            const label = kpi?.label ?? labels[index];
            const sectionError = data?.sectionErrors?.[target.section];
            const needsAction = data && !sectionError && (target.field === 'complianceOpenCount' || target.field === 'pendingApprovals') && data[target.field] > 0;
            return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeButton key={target.field} type="button" className="qm-kpi" data-qm-kpi={target.field} data-tone={sectionError ? 'error' : needsAction ? 'warning' : undefined} aria-label={`${label} ansehen`} title={sectionError || undefined} onClick={() => open(target.path)}><NativeSpan className="qm-kpi-top"><NativeSpan>{label}</NativeSpan><CatalogIcon kind={target.icon}/></NativeSpan><NativeStrong>{kpi?.value ?? '—'}</NativeStrong><NativeSmall>{kpi?.subValue ?? (busy ? 'Wird geladen' : 'Nicht geladen')}</NativeSmall></NativeButton>}</NativeWorkspaceStyleScope>;
        })}</NativeDiv>
      </NativeSection>

      <NativeSection aria-label="Handbuch, Dokumente und Vorlagen" className="qm-shortcuts">{SHORTCUTS.map(item => <NativeButton key={item.id} type="button" className="qm-shortcut" aria-label={`${item.title} öffnen`} onClick={() => open(item.path)}><NativeDiv><NativeStrong className="qm-shortcut-title">{item.title}</NativeStrong><NativeP>{item.description}</NativeP><NativeSpan className="qm-shortcut-open">Öffnen<CatalogIcon kind="arrow"/></NativeSpan></NativeDiv><DesktopCatalogArtwork route={item.artwork} label={item.title} size={64}/></NativeButton>)}</NativeSection>

      <NativeSection className="qm-panel" aria-labelledby="qm-register-title"><NativeDiv className="qm-panel-head"><NativeDiv><NativeH2 id="qm-register-title">Prüfungen & Organisation</NativeH2><NativeP>Vorhandene Einträge, Zuständigkeiten und Nachweise ansehen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="qm-registers">{REGISTERS.map(item => <NativeButton key={item.path} type="button" className="qm-register" onClick={() => open(item.path)} aria-label={`${item.title} ansehen`}><NativeSpan className="qm-register-icon"><CatalogIcon kind={item.icon}/></NativeSpan><NativeSpan><NativeStrong>{item.title}</NativeStrong><NativeSmall>{item.description}</NativeSmall></NativeSpan><NativeSpan className="qm-register-arrow"><CatalogIcon kind="arrow"/></NativeSpan></NativeButton>)}</NativeDiv></NativeSection>

      <NativeDiv className="qm-two-col">
        <NativeSection className="qm-panel" aria-labelledby="qm-audits-title"><NativeDiv className="qm-panel-head"><NativeDiv><NativeH2 id="qm-audits-title">Anstehende Audits</NativeH2><NativeP>Geplante Prüfungen und laufende Nachbereitung</NativeP></NativeDiv><CatalogIcon kind="search"/></NativeDiv><AuditSummary data={data} loading={query.loading}/><NativeDiv className="qm-panel-footer"><NativeButton type="button" className="qm-button qm-button--quiet" onClick={() => open('audits')}>Alle Audits<CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeSection>
        <NativeSection className="qm-panel" aria-labelledby="qm-changes-title"><NativeDiv className="qm-panel-head"><NativeDiv><NativeH2 id="qm-changes-title">Letzte Änderungen</NativeH2><NativeP>Korrekturen und Verbesserungsvorschläge</NativeP></NativeDiv><CatalogIcon kind="edit"/></NativeDiv><ChangeSummary data={data} loading={query.loading}/><NativeDiv className="qm-panel-footer"><NativeButton type="button" className="qm-button qm-button--quiet" onClick={() => open('changes')}>Alle Änderungen<CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeSection>
      </NativeDiv>

      <NativeDetails className="qm-panel qm-specialists"><NativeSummary><NativeDiv><NativeH2>Weitere Fachbereiche</NativeH2><NativeP>Vorbereitete Bereiche und ihr aktueller Freigabestand</NativeP></NativeDiv></NativeSummary><NativeDiv className="qm-panel-body"><NativeDiv className="qm-specialist-options">{SPECIALIST_AREAS.map(area => <NativeButton type="button" key={area.id} className="qm-specialist-button" aria-pressed={activeSpecialist === area.id} onClick={() => setActiveSpecialist(area.id)}><CatalogIcon kind={area.icon}/><NativeSpan>{area.title}<NativeSmall>Noch nicht freigeschaltet</NativeSmall></NativeSpan></NativeButton>)}</NativeDiv>{specialist ? <NativeDiv className="qm-specialist-explanation"><NativeSpan className="qm-status" data-tone="warning">Noch nicht freigeschaltet</NativeSpan><NativeH3 ref={specialistHeading} tabIndex={-1} style={{ marginTop: 12 }}>{specialist.title}</NativeH3><NativeP>{specialist.description}</NativeP><NativeP>Dieser Bereich ist noch nicht freigeschaltet. Ihre vorhandenen QM-Dokumente bleiben verfügbar.</NativeP><NativeDiv className="qm-actions"><NativeButton type="button" className="qm-button" onClick={() => open('documents')}>Zu den QM-Dokumenten<CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeDiv> : <NativeP className="qm-muted">Wählen Sie einen Bereich, um seinen Freigabestand anzusehen.</NativeP>}<NativeP className="qm-muted" style={{ fontSize: 12, marginTop: 18 }}>Export, KI-Assistent und erweiterte QM-Einstellungen sind ebenfalls noch nicht freigeschaltet.</NativeP></NativeDiv></NativeDetails>
    </NativeSection>
  </ScreenShell>}</NativeWorkspaceStyleScope>;
}
function SummaryLoading() { return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeDiv className="qm-loading" role="status"><NativeSpan className="qm-sr">Einträge werden geladen …</NativeSpan><NativeDiv className="qm-skeleton"/><NativeDiv className="qm-skeleton"/><NativeDiv className="qm-skeleton"/></NativeDiv>}</NativeWorkspaceStyleScope>; }
function AuditSummary({ data, loading }: {
    data: QmDashboardSnapshot | null;
    loading: boolean;
}) {
    if (!data && loading)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<SummaryLoading />}</NativeWorkspaceStyleScope>;
    if (!data || data.sectionErrors?.audits)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeDiv className="qm-empty"><NativeH3>Auditstand nicht verfügbar</NativeH3><NativeP>{data?.sectionErrors?.audits ?? 'Die gespeicherten Audits konnten noch nicht geladen werden.'}</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (!data.upcomingAudits.length)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeDiv className="qm-empty"><NativeH3>Keine anstehenden Audits</NativeH3><NativeP>Im geladenen Bestand sind derzeit keine geplanten oder laufenden Audits hinterlegt.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    const statusLabels = { planned: 'Geplant', in_progress: 'In Bearbeitung', follow_up: 'Nachbereitung', completed: 'Abgeschlossen' };
    return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeUl className="qm-record-list">{data.upcomingAudits.slice(0, 5).map(audit => { const date = dateParts(audit.scheduledAt); return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeLi key={audit.id}><NativeDiv className="qm-record-row"><NativeSpan className="qm-date-tile" aria-hidden="true"><NativeStrong>{date?.day ?? '—'}</NativeStrong>{date?.month ?? 'Termin'}</NativeSpan><NativeDiv><NativeStrong>{audit.title}</NativeStrong><NativeP>{date?.full ?? 'Termin nicht hinterlegt'}{audit.auditorName ? ` · ${audit.auditorName}` : ''}</NativeP><NativeSmall>{statusLabels[audit.status]}</NativeSmall></NativeDiv></NativeDiv></NativeLi>}</NativeWorkspaceStyleScope>; })}</NativeUl>}</NativeWorkspaceStyleScope>;
}
function ChangeSummary({ data, loading }: {
    data: QmDashboardSnapshot | null;
    loading: boolean;
}) {
    if (!data && loading)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<SummaryLoading />}</NativeWorkspaceStyleScope>;
    if (!data || data.sectionErrors?.changes)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeDiv className="qm-empty"><NativeH3>Änderungen nicht verfügbar</NativeH3><NativeP>{data?.sectionErrors?.changes ?? 'Der Änderungsstand konnte noch nicht geladen werden.'}</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (!data.recentChanges.length)
        return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeDiv className="qm-empty"><NativeH3>Noch keine Änderungen erfasst</NativeH3><NativeP>Hinterlegte Korrekturen und Verbesserungsvorschläge erscheinen hier mit ihrem Status.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    const statusLabels = { open: 'Offen', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen', cancelled: 'Verworfen' };
    return <NativeWorkspaceStyleScope css={[qmWorkspaceCss]}>{<NativeUl className="qm-record-list">{data.recentChanges.slice(0, 5).map(change => <NativeLi key={change.id}><NativeDiv className="qm-record-row"><NativeSpan className="qm-register-icon"><CatalogIcon kind="edit"/></NativeSpan><NativeDiv><NativeStrong>{change.title}</NativeStrong>{change.description ? <NativeP>{change.description}</NativeP> : null}<NativeSmall>{statusLabels[change.status]}{dateParts(change.updatedAt) ? ` · ${dateParts(change.updatedAt)!.full}` : ''}</NativeSmall></NativeDiv></NativeDiv></NativeLi>)}</NativeUl>}</NativeWorkspaceStyleScope>;
}
