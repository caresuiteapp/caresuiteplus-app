import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { useGoogleWorkspace, useWorkspacePage } from '@/hooks/useGoogleWorkspace.native';
import { googleTime, serviceDefinition, workspaceHref, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';
import { NativeAction, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
export function GoogleWorkspaceWidget({ service }: { service: WorkspaceService | 'overview' }) {
  const router = useRouter(); const { roleKey } = usePermissions();
  const allowed = roleKey === 'business_admin' || roleKey === 'business_manager';
  const state = useGoogleWorkspace(allowed); const connected = state.connection?.status === 'connected';
  const key = service === 'overview' ? 'gmail' : service;
  const page = useWorkspacePage(key, {}, allowed && connected && service !== 'overview' && !!state.connection?.capabilities[key], state.connection?.connectedAt ?? '');
  const title = service === 'overview' ? 'Google Workspace' : serviceDefinition(service).title;
  return <View style={[ui.stack, { padding: 18, flex: 1 }]}>
    <Text style={ui.title}>{title}</Text>
    {!allowed ? <Text style={ui.muted}>Zugang für Geschäftsführung und Verwaltung.</Text> : state.error || page.error ? <><Text accessibilityRole="alert" style={ui.error}>{state.error || page.error}</Text><NativeAction label="Erneut laden" onPress={() => { void state.refresh(); void page.refresh(); }} /></> : state.loading || page.loading ? <Text style={ui.muted}>Wird geladen …</Text> : !connected ? <Text style={ui.body}>Google-Konto verbinden und Dienste freigeben.</Text> : service === 'overview' ? <><Text style={ui.body}>{state.connection?.email}</Text><Text style={ui.muted}>{Object.values(state.connection?.capabilities ?? {}).filter(Boolean).length} Dienste freigegeben</Text></> : !state.connection?.capabilities[key] ? <Text style={ui.muted}>Google-Freigabe fehlt.</Text> : page.data?.items.length ? page.data.items.slice(0, 3).map(item => <View key={item.id}><Text numberOfLines={2} style={ui.label}>{item.unread ? '● ' : ''}{item.title}</Text><Text numberOfLines={2} style={ui.muted}>{item.when ? googleTime(item.when) : item.subtitle}</Text></View>) : <Text style={ui.muted}>Keine Einträge vorhanden.</Text>}
    <NativeAction label="Arbeitsbereich öffnen" disabled={!allowed} onPress={() => router.push(workspaceHref(service) as never)} />
  </View>;
}
