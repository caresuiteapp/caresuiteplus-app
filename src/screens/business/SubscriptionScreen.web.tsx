import { useRouter } from 'expo-router';
import type { ProductKey } from '@/types';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { ROLE_LABELS } from '@/data/constants';
import { useSubscriptionWorkspace } from '@/hooks/useSubscriptionWorkspace.web';
import { getRouteByPath } from '@/lib/navigation/routes';
import { SubscriptionWorkspace } from './SubscriptionWorkspace.web';

const STATE_CSS = `
.cs-platform-state{color-scheme:light;box-sizing:border-box;max-width:680px;width:100%;margin:30px auto;padding:clamp(20px,4vw,34px);background:#fff;border:1px solid #d8e5f1;border-radius:22px;box-shadow:0 8px 24px #214b7910;color:#19344f;font:inherit;font-size:calc(15px * var(--app-font-scale,1));line-height:1.6;overflow-wrap:anywhere}
.cs-platform-state h1{font-size:1.45em;line-height:1.3;margin:0 0 10px;letter-spacing:-.025em}.cs-platform-state p{color:#526a80;margin:0}.cs-platform-state-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.cs-platform-state button{font:inherit;font-size:.9em;font-weight:650;min-height:44px;padding:10px 16px;background:#edf5ff;color:#155e9b;border:1px solid #c9dff2;border-radius:11px;cursor:pointer}.cs-platform-state button:focus-visible{outline:3px solid #1376cd;outline-offset:3px}.cs-platform-state button:disabled{opacity:.55;cursor:wait}
`;

/** Web-specific overview; native subscription screens keep their existing implementation. */
export function SubscriptionScreen() {
  const router = useRouter();
  const { data, loading, error, errorCode, refresh, identityKey, roleKey } = useSubscriptionWorkspace();
  const openDesktop = () => router.push('/Desktop' as never);
  const desktopRoles = getRouteByPath('/Desktop')?.allowedRoles;
  const canOpenApps = Boolean(roleKey && desktopRoles?.includes(roleKey) && data?.modules.some(module => module.canOpen));
  const moduleActions: Partial<Record<ProductKey, () => void>> = {};
  if (data) {
    for (const module of data.modules) {
      if (module.status === 'active' && module.canOpen) {
        moduleActions[module.key] = () => router.push(module.route as never);
      }
    }
  }

  return <ScreenShell title="Plattform & Module" showBack={false} contentOwnsHeader>
    {data ? <SubscriptionWorkspace key={identityKey} data={data} loading={loading} error={error}
      roleLabel={roleKey ? ROLE_LABELS[roleKey] : null} onRefresh={refresh}
      onOpenApps={canOpenApps ? () => router.push('/Desktop?center=apps' as never) : null} moduleActions={moduleActions} /> :
      <div className="cs-platform-state" aria-busy={loading}>
        <style>{STATE_CSS}</style><h1>Plattform &amp; Module</h1>
        {loading ? <p role="status">Ihr Unternehmen und die Modulfreigaben werden geladen…</p> :
          <><p role="alert">{error || 'Die Plattformübersicht ist derzeit nicht verfügbar.'}</p>
            <div className="cs-platform-state-actions">
              <button type="button" onClick={refresh}>{errorCode === 'permission' ? 'Berechtigung erneut prüfen' : 'Erneut versuchen'}</button>
              <button type="button" onClick={openDesktop}>Zum Desktop</button>
            </div>
          </>}
      </div>}
  </ScreenShell>;
}
