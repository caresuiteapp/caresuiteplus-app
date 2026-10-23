import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { CatalogIcon } from '@/components/catalog/CatalogWorkspace.web';
import { qmWorkspaceCss } from '@/components/qm/qmWorkspaceCss.web';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork.web';
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
  if (!Number.isFinite(date.getTime())) return null;
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

  useEffect(() => { if (activeSpecialist) specialistHeading.current?.focus({ preventScroll: true }); }, [activeSpecialist]);

  return <ScreenShell title="Qualitätsmanagement" contentOwnsHeader>
    <style>{qmWorkspaceCss}</style>
    <section className="qm-workspace" data-testid="qm-dashboard-workspace" aria-label="Qualitätsmanagement">
      <header className="qm-header">
        <div className="qm-heading">
          <DesktopCatalogArtwork route="/business/audit-log" label="Qualitätsmanagement" size={86} className="qm-heading-art" />
          <div><p className="qm-eyebrow">Office · Übersicht</p><h1>Qualitätsmanagement</h1><p>Handbuch, Dokumente und Prüfstände gemeinsam überblicken.</p></div>
        </div>
        <div className="qm-actions"><button type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}><CatalogIcon kind="refresh" />{busy ? 'Wird geladen …' : 'Aktualisieren'}</button><button type="button" className="qm-button qm-button--primary" onClick={() => open('documents')}><CatalogIcon kind="layers" />Dokumente ansehen</button></div>
      </header>

      {error ? <div className="qm-notice" data-tone="error" role="alert"><div><strong>{data ? 'Aktualisierung nicht vollständig' : 'Übersicht konnte nicht geladen werden'}</strong><p>{error}</p>{data ? <p>Die verfügbaren Werte zeigen den letzten erfolgreichen Stand.</p> : <p>Nicht geladene Werte werden nicht als 0 angezeigt.</p>}</div><button type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
      {partial ? <div className="qm-notice" data-tone="warning" role="status"><div><strong>Einzelne Bereiche konnten nicht geladen werden.</strong><p>Diese Kennzahlen sind mit „—“ gekennzeichnet. Die verfügbaren Bereiche können Sie weiter öffnen.</p></div><button type="button" className="qm-button" disabled={busy} onClick={() => void query.refresh()}>Fehlende Daten erneut laden</button></div> : null}

      <section aria-label="QM-Kennzahlen" className="qm-stack" aria-busy={busy}>
        <div className="qm-data-status"><strong>Aktueller Überblick</strong><span>{busy ? 'Daten werden geladen …' : data ? `Gespeicherte QM-Daten${loadedAt ? ` · Stand ${loadedAt.full}, ${new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(data.loadedAt!))} Uhr` : ''}` : 'Noch kein bestätigter Datenstand'}</span></div>
        <div className="qm-kpis">{KPI_TARGETS.map((target, index) => {
          const kpi = kpis?.[index];
          const labels = ['Kapitel', 'Dokumente', 'Compliance offen', 'MD-Mappen', 'Freigaben offen'];
          const label = kpi?.label ?? labels[index];
          const sectionError = data?.sectionErrors?.[target.section];
          const needsAction = data && !sectionError && (target.field === 'complianceOpenCount' || target.field === 'pendingApprovals') && data[target.field] > 0;
          return <button key={target.field} type="button" className="qm-kpi" data-qm-kpi={target.field} data-tone={sectionError ? 'error' : needsAction ? 'warning' : undefined} aria-label={`${label} ansehen`} title={sectionError || undefined} onClick={() => open(target.path)}><span className="qm-kpi-top"><span>{label}</span><CatalogIcon kind={target.icon} /></span><strong>{kpi?.value ?? '—'}</strong><small>{kpi?.subValue ?? (busy ? 'Wird geladen' : 'Nicht geladen')}</small></button>;
        })}</div>
      </section>

      <section aria-label="Handbuch, Dokumente und Vorlagen" className="qm-shortcuts">{SHORTCUTS.map(item => <button key={item.id} type="button" className="qm-shortcut" aria-label={`${item.title} öffnen`} onClick={() => open(item.path)}><div><strong className="qm-shortcut-title">{item.title}</strong><p>{item.description}</p><span className="qm-shortcut-open">Öffnen<CatalogIcon kind="arrow" /></span></div><DesktopCatalogArtwork route={item.artwork} label={item.title} size={64} /></button>)}</section>

      <section className="qm-panel" aria-labelledby="qm-register-title"><div className="qm-panel-head"><div><h2 id="qm-register-title">Prüfungen & Organisation</h2><p>Vorhandene Einträge, Zuständigkeiten und Nachweise ansehen.</p></div></div><div className="qm-registers">{REGISTERS.map(item => <button key={item.path} type="button" className="qm-register" onClick={() => open(item.path)} aria-label={`${item.title} ansehen`}><span className="qm-register-icon"><CatalogIcon kind={item.icon} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="qm-register-arrow"><CatalogIcon kind="arrow" /></span></button>)}</div></section>

      <div className="qm-two-col">
        <section className="qm-panel" aria-labelledby="qm-audits-title"><div className="qm-panel-head"><div><h2 id="qm-audits-title">Anstehende Audits</h2><p>Geplante Prüfungen und laufende Nachbereitung</p></div><CatalogIcon kind="search" /></div><AuditSummary data={data} loading={query.loading} /><div className="qm-panel-footer"><button type="button" className="qm-button qm-button--quiet" onClick={() => open('audits')}>Alle Audits<CatalogIcon kind="arrow" /></button></div></section>
        <section className="qm-panel" aria-labelledby="qm-changes-title"><div className="qm-panel-head"><div><h2 id="qm-changes-title">Letzte Änderungen</h2><p>Korrekturen und Verbesserungsvorschläge</p></div><CatalogIcon kind="edit" /></div><ChangeSummary data={data} loading={query.loading} /><div className="qm-panel-footer"><button type="button" className="qm-button qm-button--quiet" onClick={() => open('changes')}>Alle Änderungen<CatalogIcon kind="arrow" /></button></div></section>
      </div>

      <details className="qm-panel qm-specialists"><summary><div><h2>Weitere Fachbereiche</h2><p>Vorbereitete Bereiche und ihr aktueller Freigabestand</p></div></summary><div className="qm-panel-body"><div className="qm-specialist-options">{SPECIALIST_AREAS.map(area => <button type="button" key={area.id} className="qm-specialist-button" aria-pressed={activeSpecialist === area.id} onClick={() => setActiveSpecialist(area.id)}><CatalogIcon kind={area.icon} /><span>{area.title}<small>Noch nicht freigeschaltet</small></span></button>)}</div>{specialist ? <div className="qm-specialist-explanation"><span className="qm-status" data-tone="warning">Noch nicht freigeschaltet</span><h3 ref={specialistHeading} tabIndex={-1} style={{ marginTop: 12 }}>{specialist.title}</h3><p>{specialist.description}</p><p>Dieser Bereich ist noch nicht freigeschaltet. Ihre vorhandenen QM-Dokumente bleiben verfügbar.</p><div className="qm-actions"><button type="button" className="qm-button" onClick={() => open('documents')}>Zu den QM-Dokumenten<CatalogIcon kind="arrow" /></button></div></div> : <p className="qm-muted">Wählen Sie einen Bereich, um seinen Freigabestand anzusehen.</p>}<p className="qm-muted" style={{ fontSize: 12, marginTop: 18 }}>Export, KI-Assistent und erweiterte QM-Einstellungen sind ebenfalls noch nicht freigeschaltet.</p></div></details>
    </section>
  </ScreenShell>;
}

function SummaryLoading() { return <div className="qm-loading" role="status"><span className="qm-sr">Einträge werden geladen …</span><div className="qm-skeleton" /><div className="qm-skeleton" /><div className="qm-skeleton" /></div>; }

function AuditSummary({ data, loading }: { data: QmDashboardSnapshot | null; loading: boolean }) {
  if (!data && loading) return <SummaryLoading />;
  if (!data || data.sectionErrors?.audits) return <div className="qm-empty"><h3>Auditstand nicht verfügbar</h3><p>{data?.sectionErrors?.audits ?? 'Die gespeicherten Audits konnten noch nicht geladen werden.'}</p></div>;
  if (!data.upcomingAudits.length) return <div className="qm-empty"><h3>Keine anstehenden Audits</h3><p>Im geladenen Bestand sind derzeit keine geplanten oder laufenden Audits hinterlegt.</p></div>;
  const statusLabels = { planned: 'Geplant', in_progress: 'In Bearbeitung', follow_up: 'Nachbereitung', completed: 'Abgeschlossen' };
  return <ul className="qm-record-list">{data.upcomingAudits.slice(0, 5).map(audit => { const date = dateParts(audit.scheduledAt); return <li key={audit.id}><div className="qm-record-row"><span className="qm-date-tile" aria-hidden="true"><strong>{date?.day ?? '—'}</strong>{date?.month ?? 'Termin'}</span><div><strong>{audit.title}</strong><p>{date?.full ?? 'Termin nicht hinterlegt'}{audit.auditorName ? ` · ${audit.auditorName}` : ''}</p><small>{statusLabels[audit.status]}</small></div></div></li>; })}</ul>;
}

function ChangeSummary({ data, loading }: { data: QmDashboardSnapshot | null; loading: boolean }) {
  if (!data && loading) return <SummaryLoading />;
  if (!data || data.sectionErrors?.changes) return <div className="qm-empty"><h3>Änderungen nicht verfügbar</h3><p>{data?.sectionErrors?.changes ?? 'Der Änderungsstand konnte noch nicht geladen werden.'}</p></div>;
  if (!data.recentChanges.length) return <div className="qm-empty"><h3>Noch keine Änderungen erfasst</h3><p>Hinterlegte Korrekturen und Verbesserungsvorschläge erscheinen hier mit ihrem Status.</p></div>;
  const statusLabels = { open: 'Offen', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen', cancelled: 'Verworfen' };
  return <ul className="qm-record-list">{data.recentChanges.slice(0, 5).map(change => <li key={change.id}><div className="qm-record-row"><span className="qm-register-icon"><CatalogIcon kind="edit" /></span><div><strong>{change.title}</strong>{change.description ? <p>{change.description}</p> : null}<small>{statusLabels[change.status]}{dateParts(change.updatedAt) ? ` · ${dateParts(change.updatedAt)!.full}` : ''}</small></div></div></li>)}</ul>;
}
