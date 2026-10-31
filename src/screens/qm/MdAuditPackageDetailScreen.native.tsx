// Generated native presentation from src/screens/qm/MdAuditPackageDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeStyle,NativeDiv,NativeStrong,NativeP,NativeSection,NativeHeader,NativeH2,NativeSpan,NativeDl,NativeDt,NativeDd,NativeArticle,NativeH3,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
import { useQmTenantQuery } from "../../hooks/qm/useQmBase.native.ts";
import { getServiceMode } from '@/lib/services/mode';
import { fetchQmMdPackageRead } from "../../lib/qm/qmRegisterService.native.ts";
import { QM_REGISTER_LABELS } from "../../lib/qm/qmRegisterDomain.native.ts";
import { qmRegisterCss } from "./QmRegisterScreen.native.tsx";
import { MdAuditPackageDetailScreen as DemoMdAuditPackageDetailScreen } from './MdAuditPackageDetailScreen.tsx';
function LiveMdAuditPackageDetailScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const packageId = typeof params.id === 'string' ? params.id : '';
    const router = useRouter();
    const query = useQmTenantQuery((tenantId, roleKey) => fetchQmMdPackageRead(tenantId, packageId, roleKey), [packageId]);
    const data = query.data;
    const refresh = <NativeButton type="button" className="qm-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>{query.loading || query.refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}</NativeButton>;
    return <NativeWorkspaceStyleScope css={[qmRegisterCss, qmRegisterCss]}>{<QmSectionShell title={data?.entry.title ?? 'MD-Prüfungsmappe'} subtitle="Gespeicherte Mappe und zugeordnete Dokumentfassungen" actions={refresh}>
    <NativeStyle>{qmRegisterCss}</NativeStyle>
    <>
      <NativeDiv className="qm-actions"><NativeButton type="button" className="qm-button" onClick={() => router.push('/business/office/qm/md-audit' as never)}>← Alle Prüfungsmappen</NativeButton></NativeDiv>
      <NativeDiv className="qm-notice">Die gespeicherte Fassung wird angezeigt. Bearbeitung, externe Freigabe und Export sind noch nicht freigeschaltet.</NativeDiv>
      {query.loading && !data ? <NativeDiv className="qm-empty" role="status">Prüfungsmappe wird geladen…</NativeDiv> : null}
      {query.error ? <NativeDiv className="qm-notice" data-tone="error" role="alert"><NativeStrong>Mappe nicht verfügbar</NativeStrong><NativeP>{query.error}</NativeP>{refresh}</NativeDiv> : null}
      {query.refreshError ? <NativeDiv className="qm-notice" data-tone="warning" role="alert">{query.refreshError} Die zuletzt geladenen Daten bleiben sichtbar.{refresh}</NativeDiv> : null}
      {data ? <>
        <NativeSection className="qm-panel qm-register-entry"><NativeHeader className="qm-register-entry-header"><NativeH2>{data.entry.category}</NativeH2><NativeSpan className="qm-status">{QM_REGISTER_LABELS[data.entry.status] ?? data.entry.status}</NativeSpan></NativeHeader>
          <NativeDl className="qm-register-meta">{data.entry.details.map(detail => <NativeDiv key={detail.label}><NativeDt>{detail.label}</NativeDt><NativeDd>{detail.value}</NativeDd></NativeDiv>)}</NativeDl>
          {data.entry.summary ? <NativeP className="qm-register-copy">{data.entry.summary}</NativeP> : null}
        </NativeSection>
        <NativeSection className="qm-panel qm-register-entry"><NativeH2>{data.items.length} zugeordnete Dokumente</NativeH2>
          {data.items.length === 0 ? <NativeP className="qm-register-copy">In dieser Mappe sind keine Dokumentreferenzen hinterlegt.</NativeP> : data.items.map((item, index) => <NativeArticle key={item.id} className="qm-register-details"><NativeH3>Dokument {index + 1}</NativeH3><NativeDl className="qm-register-meta"><NativeDiv><NativeDt>Dokument-ID</NativeDt><NativeDd>{item.documentId}</NativeDd></NativeDiv><NativeDiv><NativeDt>In der Mappe referenzierte Fassung</NativeDt><NativeDd>{item.includedVersionId ?? 'Keine Fassung hinterlegt'}</NativeDd></NativeDiv></NativeDl>{item.notes ? <NativeP className="qm-register-copy">{item.notes}</NativeP> : null}<NativeP className="qm-register-muted">Die Dokumentansicht zeigt die gespeicherte aktuelle Referenz. Diese kann von der hier zugeordneten Fassung abweichen.</NativeP><NativeButton type="button" className="qm-button" onClick={() => router.push(`/business/office/qm/documents/${encodeURIComponent(item.documentId)}` as never)}>Dokument ansehen</NativeButton></NativeArticle>)}
        </NativeSection>
      </> : null}
    </>
  </QmSectionShell>}</NativeWorkspaceStyleScope>;
}
export function MdAuditPackageDetailScreen() {
    return getServiceMode() === 'demo' ? <DemoMdAuditPackageDetailScreen /> : <LiveMdAuditPackageDetailScreen />;
}
