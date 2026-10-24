// Generated native presentation from src/screens/qm/QmPreparedFeatureScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeP,NativeButton,NativeSection,NativeSpan,NativeH2} from '@/components/layout/NativeWorkspaceElements.native';
import { useRouter } from 'expo-router';
import type { PermissionKey } from '@/types/permissions';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
type PreparedFeature = 'settings' | 'ai' | 'export';
const features: Record<PreparedFeature, {
    title: string;
    description: string;
    permission: PermissionKey;
    details: string;
}> = {
    settings: { title: 'QM-Einstellungen', description: 'Reviewzyklen und Freigabeabläufe', permission: 'qm.manage_settings', details: 'Für Reviewzyklen, Freigabestufen und die Gültigkeit externer Links ist noch keine gespeicherte Mandantenkonfiguration angebunden. Deshalb werden hier keine Beispielwerte als aktive Einstellungen angezeigt.' },
    ai: { title: 'QM-Assistent', description: 'Unterstützung beim Erstellen und Überarbeiten von QM-Inhalten', permission: 'qm.use_ai_assistant', details: 'Die automatische Erstellung und Überarbeitung von QM-Inhalten ist noch nicht freigeschaltet. Gespeicherte Dokumente und ihre Fassungen bleiben über die Dokumentübersicht erreichbar.' },
    export: { title: 'QM-Export', description: 'Dokumentpakete für die Weitergabe', permission: 'qm.export_qm_documents', details: 'Die Erstellung vollständiger QM-Exportpakete ist noch nicht freigeschaltet. Es werden keine Download-Links für nicht erzeugte Dateien angeboten. Vorhandene Prüfungsmappen können in der MD-Übersicht gelesen werden.' },
};
export function QmPreparedFeatureScreen({ feature }: {
    feature: PreparedFeature;
}) {
    const router = useRouter();
    const runtime = useCareRuntimePermissions();
    const config = features[feature];
    return <QmSectionShell title={config.title} subtitle={config.description}>
    {runtime.loading ? <NativeDiv className="qm-empty" role="status">Zugriffsrechte werden geprüft…</NativeDiv> : runtime.error ? <NativeDiv className="qm-notice" data-tone="error" role="alert"><NativeP>{runtime.error}</NativeP><NativeButton className="qm-button" type="button" onClick={runtime.refreshPermissions}>Erneut prüfen</NativeButton></NativeDiv> : !runtime.can(config.permission) ? <NativeDiv className="qm-notice" data-tone="warning">{runtime.check(config.permission).reason || 'Für diesen Bereich fehlt die Berechtigung.'}</NativeDiv> : <NativeSection className="qm-panel qm-panel-body qm-stack">
      <NativeDiv><NativeSpan className="qm-status">In Vorbereitung</NativeSpan><NativeH2 style={{ marginTop: 14 }}>Dieser Ablauf ist noch nicht freigeschaltet</NativeH2></NativeDiv>
      <NativeP className="qm-muted">{config.details}</NativeP>
      <NativeDiv className="qm-actions"><NativeButton type="button" className="qm-button qm-button--primary" onClick={() => router.push('/business/office/qm/documents' as never)}>QM-Dokumente ansehen</NativeButton>{feature === 'export' ? <NativeButton type="button" className="qm-button" onClick={() => router.push('/business/office/qm/md-audit' as never)}>Prüfungsmappen ansehen</NativeButton> : null}</NativeDiv>
    </NativeSection>}
  </QmSectionShell>;
}
