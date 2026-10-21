import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { ensurePortalWriteSession } from '@/lib/auth/portalSupabaseAuth';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import { loadAcademyWorkspace, mutateAcademyWorkspace, applyAcademyMutationReceipt, AcademyWorkspaceError } from '@/lib/akademie/workspaceService';
import { downloadAcademyCertificate } from '@/lib/akademie/certificatePdf';
import {
  activateAcademyDraftScope, clearAcademyDrafts, clearPendingAcademyCommand,
  getPendingAcademyCommand, rememberPendingAcademyCommand, subscribeAcademyDrafts,
} from '@/lib/akademie/workspaceDrafts';
import type {
  AcademyAudience, AcademyCertificate, AcademyCommand, AcademyCommandHandler,
  AcademyMutationResult, AcademySection, AcademyView, AcademyWorkspace,
} from '@/lib/akademie/workspaceModel';
import { AcademyWorkspaceView } from './AcademyWorkspace.web';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

const statusPanel: CSSProperties = {
  margin: 12, padding: 16, borderRadius: 16, border: `1px solid ${careSuiteAuroraTheme.glass.borderStrong}`,
  background: careSuiteAuroraTheme.glass.backgroundStrong, color: systemLiquidGlass.text.primary,
  boxShadow: systemLiquidGlass.shadowSoft, lineHeight: 1.5,
};
const statusAction: CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: `1px solid ${careSuiteAuroraTheme.glass.borderStrong}`,
  background: systemLiquidGlass.rowSelected, color: systemLiquidGlass.text.primary,
  font: 'inherit', fontWeight: 700, cursor: 'pointer',
};

type Props = {
  view?: AcademyView;
  initialSection?: AcademySection;
  initialAudience?: AcademyAudience;
  initialMandatoryOnly?: boolean;
  initialCourseId?: string;
  initialEnrollmentId?: string;
  initialCertificateId?: string;
  createInitially?: boolean;
};

const sectionKeys = new Set<AcademySection>(['overview', 'courses', 'templates', 'assignments', 'planning', 'reports', 'reviews', 'certificates', 'library']);
function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

export function AcademyWorkspaceScreen({ view = 'office', ...props }: Props) {
  const auth = useAuth();
  const params = useLocalSearchParams<{ section?: string; course?: string; enrollment?: string; certificate?: string }>();
  const tenantId = auth.portalSession?.tenantId ?? auth.profile?.tenantId ?? null;
  const ready = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId);
  const scope = JSON.stringify([auth.user?.id ?? null, tenantId, auth.portalSession?.accountId ?? null, view]);
  const requestedSection = first(params.section) as AcademySection | undefined;
  const preferredSection = props.initialSection ?? (requestedSection && sectionKeys.has(requestedSection) ? requestedSection : undefined);
  const safeSection = view === 'learner' && preferredSection && !['overview', 'planning', 'certificates', 'library'].includes(preferredSection) ? 'overview' : preferredSection;
  useEffect(() => { if (!auth.user || !auth.isAuthenticated) clearAcademyDrafts(); }, [auth.user, auth.isAuthenticated]);
  return <ConnectedAcademy key={`${scope}:${ready ? 'authenticated' : 'inactive'}`} {...props} view={view} scope={scope}
    tenantId={ready ? tenantId : null} authLoading={!auth.authReady || auth.isLoading}
    portalSession={auth.portalSession}
    initialSection={safeSection}
    initialCourseId={props.initialCourseId ?? first(params.course)}
    initialEnrollmentId={props.initialEnrollmentId ?? first(params.enrollment)}
    initialCertificateId={props.initialCertificateId ?? first(params.certificate)} />;
}

function ConnectedAcademy({ tenantId, scope, portalSession, authLoading, view, initialCertificateId, ...props }: Props & {
  tenantId: string | null; scope: string; portalSession: PortalSessionRecord | null; authLoading: boolean; view: AcademyView;
}) {
  const [workspace, setWorkspace] = useState<AcademyWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [pending, setPending] = useState<AcademyCommand | null>(() => getPendingAcademyCommand(scope));
  const mounted = useRef(true);
  const sequence = useRef(0);
  const writeLock = useRef(false);
  const refreshRequiredRef = useRef(false);
  const ownSettledRequest = useRef<string | null>(null);
  const previousPending = useRef(pending);
  const portalRef = useRef(portalSession);
  portalRef.current = portalSession;

  useEffect(() => {
    mounted.current = true;
    if (tenantId) activateAcademyDraftScope(scope);
    const refreshPending = () => { if (mounted.current) setPending(getPendingAcademyCommand(scope)); };
    refreshPending();
    const unsubscribe = subscribeAcademyDrafts(refreshPending);
    return () => { mounted.current = false; sequence.current++; unsubscribe(); };
  }, [scope, tenantId]);

  const reload = useCallback(async (background = false) => {
    if (!tenantId || writeLock.current) return;
    const request = ++sequence.current;
    if (!background) setLoading(true);
    try {
      const result = await loadAcademyWorkspace(tenantId, view);
      if (!mounted.current || request !== sequence.current) return;
      setWorkspace(result);
      refreshRequiredRef.current = false;
      setRefreshRequired(false);
      if (!background) setError(null);
    } catch (cause) {
      if (mounted.current && request === sequence.current) setError(cause instanceof Error ? cause.message : 'Die Akademie konnte nicht geladen werden.');
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [tenantId, view]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const previous = previousPending.current;
    previousPending.current = pending;
    if (previous && !pending && ownSettledRequest.current !== previous.requestId && tenantId) {
      // Another mounted route received the receipt after this screen had loaded.
      refreshRequiredRef.current = true;
      setRefreshRequired(true);
      void reload(true);
    }
  }, [pending, reload, tenantId]);
  useEffect(() => {
    if (!pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [pending]);

  const sendCommand = async (command: AcademyCommand, retry = false): Promise<AcademyMutationResult | null> => {
    if (!tenantId || writeLock.current) return null;
    writeLock.current = true;
    sequence.current++;
    setBusy(true);
    setLoading(false);
    setError(null);
    setNotice(null);
    let dispatched = false;
    try {
      if (portalRef.current) {
        const session = await ensurePortalWriteSession(portalRef.current);
        if (!session.ok) throw new Error(session.error);
      }
      if (!mounted.current || getPendingAcademyCommand(scope)?.requestId !== command.requestId) return null;
      dispatched = true;
      const result = await mutateAcademyWorkspace(tenantId, view, command);
      // Acknowledgement is authoritative; a subsequent read must not turn success into failure.
      ownSettledRequest.current = command.requestId;
      if (getPendingAcademyCommand(scope)?.requestId === command.requestId) clearPendingAcademyCommand(scope);
      if (!mounted.current) return null;
      setWorkspace((current) => current ? applyAcademyMutationReceipt(current, command, result) : current);
      refreshRequiredRef.current = true;
      setRefreshRequired(true);
      setNotice(result.replayed ? 'Der bereits gespeicherte Vorgang wurde bestätigt.' : 'Gespeichert und bestätigt.');
      writeLock.current = false;
      void reload(true);
      return result;
    } catch (cause) {
      const uncertain = dispatched ? (!(cause instanceof AcademyWorkspaceError) || cause.uncertain) : retry;
      if (!uncertain && getPendingAcademyCommand(scope)?.requestId === command.requestId) {
        ownSettledRequest.current = command.requestId;
        clearPendingAcademyCommand(scope);
      }
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Übertragung konnte nicht bestätigt werden.');
      if (mounted.current && cause instanceof AcademyWorkspaceError && cause.code === '40001') {
        // Keep the local editor draft while loading the revision it must be compared with.
        refreshRequiredRef.current = true;
        setRefreshRequired(true);
        writeLock.current = false;
        void reload(true);
      }
      return null;
    } finally {
      writeLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const command: AcademyCommandHandler = async (action, data, record) => {
    if (!tenantId || writeLock.current || refreshRequiredRef.current || getPendingAcademyCommand(scope)) return null;
    const next: AcademyCommand = structuredClone({ action, data, recordId: record?.id ?? null, expectedRevision: record?.revision ?? null, requestId: crypto.randomUUID() });
    if (!rememberPendingAcademyCommand(scope, next)) return null;
    return sendCommand(next);
  };

  const download = async (certificate: AcademyCertificate) => {
    const authoritative = workspace?.certificates.find((entry) => entry.id === certificate.id);
    if (!authoritative || writeLock.current || refreshRequiredRef.current || pending) return;
    try { await downloadAcademyCertificate(authoritative); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Der Nachweis konnte nicht heruntergeladen werden.'); }
  };

  const certificateEnrollment = initialCertificateId
    ? workspace?.certificates.find((entry) => entry.id === initialCertificateId)?.enrollmentId
    : undefined;
  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
    {refreshRequired && !loading && !busy ? <div role="status" style={statusPanel}>
      <strong>Aktuellen Datenstand abgleichen</strong>
      <p style={{ margin: '6px 0 12px' }}>Bitte laden Sie den aktuellen Stand, bevor Sie weiterarbeiten. Ihre offenen Eingaben bleiben erhalten.</p>
      <button type="button" onClick={() => void reload()} style={statusAction}>Datenstand aktualisieren</button>
    </div> : null}
    {pending && !busy ? <div role="alert" style={statusPanel}>
      <strong>Bestätigung noch offen</strong>
      <p style={{ margin: '6px 0 12px' }}>Dieser Vorgang wird mit derselben Vorgangsnummer erneut geprüft. Bis zur Bestätigung bleiben Änderungen gesperrt.</p>
      <button type="button" onClick={() => { const same = getPendingAcademyCommand(scope); if (same) void sendCommand(same, true); }} style={statusAction}>Vorgang erneut prüfen</button>
    </div> : null}
    <AcademyWorkspaceView {...props} view={view} workspace={workspace} loading={loading || authLoading}
      busy={busy || Boolean(pending) || refreshRequired} error={error ?? (!tenantId && !authLoading ? 'Bitte melden Sie sich erneut an, um Ihre Akademie zu öffnen.' : null)} notice={notice}
      initialEnrollmentId={props.initialEnrollmentId ?? certificateEnrollment}
      onCommand={command} onReload={() => { if (!pending) void reload(); }} onDownloadCertificate={download} />
  </div>;
}

export function AcademyCourseDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AcademyWorkspaceScreen initialSection="courses" initialCourseId={first(id)} />;
}
export function AcademyEnrollmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AcademyWorkspaceScreen initialSection="assignments" initialEnrollmentId={first(id)} />;
}
export function AcademyCertificateDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AcademyWorkspaceScreen initialSection="certificates" initialCertificateId={first(id)} />;
}
