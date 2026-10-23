import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { getOpenTransfer, type DataRequest } from '@/lib/dataTransfers/service';
import { MobileButton } from '@/components/mobile/MobileWorkspace';
import { TenantDataUploadDialog } from './TenantDataUploadDialog.native';
export function TenantDataUploadGate() {
  const { profile, user, authReady, isAuthenticated, portalSession } = useAuth(); const path = usePathname();
  if (!authReady || !isAuthenticated || !user || !profile?.tenantId || portalSession || profile.roleKey !== 'business_admin' || path.startsWith('/platform') || path.startsWith('/portal')) return null;
  return <TenantTransferInbox key={`${user.id}:${profile.tenantId}`} tenantId={profile.tenantId} userId={user.id} />;
}
function TenantTransferInbox({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [request, setRequest] = useState<DataRequest | null>(null); const [visible, setVisible] = useState(false); const [error, setError] = useState(false); const [revision, setRevision] = useState(0); const seen = useRef(new Set<string>()); const insets = useSafeAreaInsets();
  useEffect(() => { let active = true; let pending = false; const check = async () => { if (pending || AppState.currentState !== 'active') return; pending = true; try { const result = await getOpenTransfer(tenantId); if (!active) return; if (result.request && result.request.tenant_id !== tenantId) throw new Error('Falsche Unternehmenszuordnung.'); setRequest(result.request); setError(false); if (result.request && !seen.current.has(result.request.id)) { seen.current.add(result.request.id); setVisible(true); } } catch { if (active) setError(true); } finally { pending = false; } }; void check(); const timer = setInterval(() => void check(), 15000); const listener = AppState.addEventListener('change', value => { if (value === 'active') void check(); }); return () => { active = false; clearInterval(timer); listener.remove(); }; }, [tenantId, revision]);
  return <>{(request || error) && !visible ? <View style={{ position: 'absolute', right: 16, left: 16, bottom: insets.bottom + 88, alignItems: 'flex-end' }} pointerEvents="box-none"><MobileButton primary label={request ? 'Datenübernahme öffnen' : 'Upload-Anfragen erneut laden'} icon="upload-cloud" onPress={() => request ? setVisible(true) : setRevision(n => n + 1)} /></View> : null}{request && visible ? <TenantDataUploadDialog key={request.id} request={request} userId={userId} onClose={() => setVisible(false)} onSubmitted={() => { setVisible(false); setRequest(null); setRevision(n => n + 1); }} /> : null}</>;
}
