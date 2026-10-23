import { useRouter } from 'expo-router';
import type { PermissionKey } from '@/types/permissions';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';

type PreparedFeature = 'settings' | 'ai' | 'export';
const features: Record<PreparedFeature, { title: string; description: string; permission: PermissionKey; details: string }> = {
  settings: { title: 'QM-Einstellungen', description: 'Reviewzyklen und Freigabeabläufe', permission: 'qm.manage_settings', details: 'Für Reviewzyklen, Freigabestufen und die Gültigkeit externer Links ist noch keine gespeicherte Mandantenkonfiguration angebunden. Deshalb werden hier keine Beispielwerte als aktive Einstellungen angezeigt.' },
  ai: { title: 'QM-Assistent', description: 'Unterstützung beim Erstellen und Überarbeiten von QM-Inhalten', permission: 'qm.use_ai_assistant', details: 'Die automatische Erstellung und Überarbeitung von QM-Inhalten ist noch nicht freigeschaltet. Gespeicherte Dokumente und ihre Fassungen bleiben über die Dokumentübersicht erreichbar.' },
  export: { title: 'QM-Export', description: 'Dokumentpakete für die Weitergabe', permission: 'qm.export_qm_documents', details: 'Die Erstellung vollständiger QM-Exportpakete ist noch nicht freigeschaltet. Es werden keine Download-Links für nicht erzeugte Dateien angeboten. Vorhandene Prüfungsmappen können in der MD-Übersicht gelesen werden.' },
};

export function QmPreparedFeatureScreen({ feature }: { feature: PreparedFeature }) {
  const router = useRouter();
  const runtime = useCareRuntimePermissions();
  const config = features[feature];
  return <QmSectionShell title={config.title} subtitle={config.description}>
    {runtime.loading ? <div className="qm-empty" role="status">Zugriffsrechte werden geprüft…</div> : runtime.error ? <div className="qm-notice" data-tone="error" role="alert"><p>{runtime.error}</p><button className="qm-button" type="button" onClick={runtime.refreshPermissions}>Erneut prüfen</button></div> : !runtime.can(config.permission) ? <div className="qm-notice" data-tone="warning">{runtime.check(config.permission).reason || 'Für diesen Bereich fehlt die Berechtigung.'}</div> : <section className="qm-panel qm-panel-body qm-stack">
      <div><span className="qm-status">In Vorbereitung</span><h2 style={{ marginTop: 14 }}>Dieser Ablauf ist noch nicht freigeschaltet</h2></div>
      <p className="qm-muted">{config.details}</p>
      <div className="qm-actions"><button type="button" className="qm-button qm-button--primary" onClick={() => router.push('/business/office/qm/documents' as never)}>QM-Dokumente ansehen</button>{feature === 'export' ? <button type="button" className="qm-button" onClick={() => router.push('/business/office/qm/md-audit' as never)}>Prüfungsmappen ansehen</button> : null}</div>
    </section>}
  </QmSectionShell>;
}
