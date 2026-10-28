// Generated native presentation from src/components/googleWorkspace/GoogleWorkspaceWidget.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSpan,NativeP,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { usePermissions } from '@/hooks/usePermissions';
import { useGoogleWorkspace, useWorkspacePage } from "../../hooks/useGoogleWorkspace.native.ts";
import { googleTime, serviceDefinition, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
export function GoogleWorkspaceWidget({ service, preview = false, fontScale = 1 }: {
    fontScale?: number;
    service: WorkspaceService | 'overview';
    preview?: boolean;
}) {
    const { roleKey } = usePermissions();
    const allowed = roleKey === 'business_admin' || roleKey === 'business_manager';
    const status = useGoogleWorkspace(allowed && !preview);
    const requested = service === 'overview' ? 'calendar' : service;
    const connected = status.connection?.status === 'connected';
    const page = useWorkspacePage(requested, {}, !preview && service !== 'overview' && allowed && connected && !!status.connection?.capabilities[requested], status.connection?.connectedAt ?? '');
    const def = service === 'overview' ? { glyph: 'G', color: '#81dfff', title: 'Google Workspace' } : serviceDefinition(service);
    const note = preview ? service === 'overview' ? 'Verbindung und Dienste im Überblick' : `${def.title} direkt auf Ihrem Desktop` : !allowed ? 'Für Geschäftsführung und Verwaltung' : status.loading ? 'Verbindung wird geprüft …' : status.error ? 'Verbindungsstatus nicht verfügbar · Öffnen zum Prüfen' : !connected ? 'Google-Konto verbinden →' : service !== 'overview' && !status.connection?.capabilities[requested] ? 'Google-Freigabe fehlt · Öffnen' : page.error ? 'Abruf fehlgeschlagen · Öffnen zum Wiederholen' : page.loading && !page.data ? 'Google-Daten werden geladen …' : undefined;
    return <NativeDiv data-cs-google-widget={service} style={{ width: '100%', height: '100%', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, color: '#eaf6ff', background: 'linear-gradient(135deg,#102b4c,#073547)', overflow: 'auto', fontSize: 14 * fontScale }}>
    <NativeDiv style={{ display: 'flex', alignItems: 'center', gap: 8 }}><NativeSpan style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: '#ffffff16', color: '#91e2ff', fontWeight: 800 }} aria-hidden="true">{def.glyph}</NativeSpan><NativeSpan style={{ fontSize: 12 * fontScale, color: '#acd6ed' }}>GOOGLE WORKSPACE</NativeSpan></NativeDiv>
    {note ? <NativeP style={{ margin: 0, fontSize: 13 * fontScale, lineHeight: 1.45, color: '#dcecf8' }}>{note}</NativeP> : <>
      {service === 'overview' ? <><NativeStrong style={{ fontSize: 14 * fontScale, overflowWrap: 'anywhere' }}>{status.connection?.email}</NativeStrong><NativeSpan style={{ fontSize: 12 * fontScale, color: '#a2ebd3' }}>{Object.values(status.connection?.capabilities ?? {}).filter(Boolean).length} Dienste freigegeben</NativeSpan></> : page.data?.items.length ? page.data.items.slice(0, 2).map(item => <NativeDiv key={item.id} style={{ borderTop: '1px solid #a8ddff26', paddingTop: 5 }}><NativeDiv style={{ fontSize: 13 * fontScale, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.unread ? '● ' : ''}{item.title}</NativeDiv><NativeDiv style={{ fontSize: 11 * fontScale, color: '#b4d6e9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.when ? googleTime(item.when) : item.subtitle}</NativeDiv></NativeDiv>) : <NativeSpan style={{ fontSize: 13 * fontScale }}>Keine Einträge in dieser Auswahl.</NativeSpan>}
      <NativeSpan style={{ fontSize: 10 * fontScale, color: '#aacbdd', marginTop: 'auto' }}>Abruf: {googleTime(service === 'overview' ? status.connection?.lastSyncAt : page.data?.fetchedAt)}</NativeSpan>
    </>}
  </NativeDiv>;
}
