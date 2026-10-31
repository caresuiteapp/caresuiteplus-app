import { useLocalSearchParams, useRouter } from 'expo-router';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';
import { useQmTenantQuery } from '@/hooks/qm/useQmBase.web';
import { getServiceMode } from '@/lib/services/mode';
import { fetchQmMdPackageRead } from '@/lib/qm/qmRegisterService.web';
import { QM_REGISTER_LABELS } from '@/lib/qm/qmRegisterDomain.web';
import { qmRegisterCss } from './QmRegisterScreen.web';
import { MdAuditPackageDetailScreen as DemoMdAuditPackageDetailScreen } from './MdAuditPackageDetailScreen.tsx';

function LiveMdAuditPackageDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const packageId = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const query = useQmTenantQuery((tenantId, roleKey) => fetchQmMdPackageRead(tenantId, packageId, roleKey), [packageId]);
  const data = query.data;
  const refresh = <button type="button" className="qm-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>{query.loading || query.refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}</button>;
  return <QmSectionShell title={data?.entry.title ?? 'MD-Prüfungsmappe'} subtitle="Gespeicherte Mappe und zugeordnete Dokumentfassungen" actions={refresh}>
    <style>{qmRegisterCss}</style>
    <>
      <div className="qm-actions"><button type="button" className="qm-button" onClick={() => router.push('/business/office/qm/md-audit' as never)}>← Alle Prüfungsmappen</button></div>
      <div className="qm-notice">Die gespeicherte Fassung wird angezeigt. Bearbeitung, externe Freigabe und Export sind noch nicht freigeschaltet.</div>
      {query.loading && !data ? <div className="qm-empty" role="status">Prüfungsmappe wird geladen…</div> : null}
      {query.error ? <div className="qm-notice" data-tone="error" role="alert"><strong>Mappe nicht verfügbar</strong><p>{query.error}</p>{refresh}</div> : null}
      {query.refreshError ? <div className="qm-notice" data-tone="warning" role="alert">{query.refreshError} Die zuletzt geladenen Daten bleiben sichtbar.{refresh}</div> : null}
      {data ? <>
        <section className="qm-panel qm-register-entry"><header className="qm-register-entry-header"><h2>{data.entry.category}</h2><span className="qm-status">{QM_REGISTER_LABELS[data.entry.status] ?? data.entry.status}</span></header>
          <dl className="qm-register-meta">{data.entry.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
          {data.entry.summary ? <p className="qm-register-copy">{data.entry.summary}</p> : null}
        </section>
        <section className="qm-panel qm-register-entry"><h2>{data.items.length} zugeordnete Dokumente</h2>
          {data.items.length === 0 ? <p className="qm-register-copy">In dieser Mappe sind keine Dokumentreferenzen hinterlegt.</p> : data.items.map((item, index) => <article key={item.id} className="qm-register-details"><h3>Dokument {index + 1}</h3><dl className="qm-register-meta"><div><dt>Dokument-ID</dt><dd>{item.documentId}</dd></div><div><dt>In der Mappe referenzierte Fassung</dt><dd>{item.includedVersionId ?? 'Keine Fassung hinterlegt'}</dd></div></dl>{item.notes ? <p className="qm-register-copy">{item.notes}</p> : null}<p className="qm-register-muted">Die Dokumentansicht zeigt die gespeicherte aktuelle Referenz. Diese kann von der hier zugeordneten Fassung abweichen.</p><button type="button" className="qm-button" onClick={() => router.push(`/business/office/qm/documents/${encodeURIComponent(item.documentId)}` as never)}>Dokument ansehen</button></article>)}
        </section>
      </> : null}
    </>
  </QmSectionShell>;
}

export function MdAuditPackageDetailScreen() {
  return getServiceMode() === 'demo' ? <DemoMdAuditPackageDetailScreen /> : <LiveMdAuditPackageDetailScreen />;
}
