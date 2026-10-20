import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getOpenTransfer, type DataRequest } from '@/lib/dataTransfers/service';
import { TransferStyle } from './TransferStyle.web';
import { TenantDataUploadDialog } from './TenantDataUploadDialog.web';

export function TenantDataUploadGate() {
  const { profile, user, authReady, isAuthenticated, portalSession } = useAuth();
  const path = usePathname();
  if (!authReady || !isAuthenticated || !user || !profile?.tenantId || portalSession
    || profile.roleKey !== 'business_admin' || path.startsWith('/platform') || path.startsWith('/portal')) return null;
  return <TenantTransferInbox key={`${user.id}:${profile.tenantId}`} tenantId={profile.tenantId} userId={user.id} />;
}

export function TenantTransferInbox({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [request, setRequest] = useState<DataRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true; let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const result = await getOpenTransfer(tenantId);
        if (!alive) return;
        if (result.request && result.request.tenant_id !== tenantId) throw new Error('Die Datenzuordnung konnte nicht bestätigt werden.');
        setRequest(result.request); setError('');
        if (result.request && !seen.current.has(result.request.id)) {
          seen.current.add(result.request.id); setVisible(true);
        }
      } catch {
        if (alive) setError('Upload-Anfragen konnten nicht geladen werden.');
      } finally { pending = false; }
    };
    refresh.current = () => { void check(); };
    void check();
    const interval = window.setInterval(() => { void check(); }, 15000);
    window.addEventListener('focus', refresh.current);
    const listener = refresh.current;
    return () => { alive = false; clearInterval(interval); window.removeEventListener('focus', listener); };
  }, [tenantId]);
  const submitted = useCallback(() => { setVisible(false); setRequest(null); refresh.current(); }, []);
  return <>
    {(request || error) && <div className="cs-console"><TransferStyle />{!visible && <button className="cs-btn primary cs-transfer-launch" onClick={() => request ? setVisible(true) : refresh.current()}>{request ? 'Datenübernahme öffnen' : 'Upload-Anfragen erneut laden'}</button>}</div>}
    {request && visible && <TenantDataUploadDialog key={request.id} request={request} userId={userId} onClose={() => setVisible(false)} onSubmitted={submitted} />}
  </>;
}
