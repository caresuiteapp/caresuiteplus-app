import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from '@/lib/platformConsole/platformCapabilities';
import { PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';
import { listPlatformCompanies } from '@/lib/platformConsole/platformCompanyDirectoryService';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { ConsoleDialog, ConsoleStyle } from './ConsoleWorkspaceUi.web';

export function PlatformGlobalSearch() {
  const router = useRouter();
  const { platformUser } = usePlatformAuth();
  const role = platformUser?.role;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<PlatformTenantListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canReadTenants = platformRoleHasCapability(role, 'tenants.read');
  const show = () => { setQuery(''); setTenants([]); setError(''); setOpen(true); };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); show();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!open || !canReadTenants) { setTenants([]); setLoading(false); return; }
    let active = true;
    setLoading(true); setError(''); setTenants([]);
    const timer = setTimeout(async () => {
      try {
        const result = await listPlatformCompanies({ search: query.trim() || undefined, limit: 12 });
        if (!result.ok) throw new Error(result.error);
        if (active) setTenants(result.data.items);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Die Unternehmenssuche ist nicht erreichbar.');
      } finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query, canReadTenants]);
  const pages = useMemo(() => PLATFORM_NAV_ITEMS.filter(item =>
    (!item.capability || platformRoleHasCapability(role, item.capability)) &&
    item.label.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de')),
  ), [query, role]);
  const go = (path: string) => { setOpen(false); router.push(path as never); };

  return <div className="cs-console"><ConsoleStyle />
    <button className="cs-btn" onClick={show} aria-label="Plattform durchsuchen, Strg oder Command K">⌕ Suchen <small>Strg K</small></button>
    {open && <ConsoleDialog title="Plattform durchsuchen" description="Verfügbare Arbeitsbereiche und registrierte Unternehmen finden." onClose={() => setOpen(false)}>
      <label className="cs-field">Suchbegriff<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Unternehmen, E-Mail oder Arbeitsbereich" /></label>
      <section><h3>Arbeitsbereiche</h3><div className="cs-actions">{pages.map(item => <button key={item.path} className="cs-btn" onClick={() => go(item.path)}>{item.icon} {item.label}</button>)}</div>{!pages.length && <p>Keine passenden Arbeitsbereiche.</p>}</section>
      {canReadTenants && <section><h3>Unternehmen</h3>{loading && <p role="status">Unternehmen werden gesucht…</p>}{error && <p className="cs-notice error" role="alert">{error}</p>}
        {tenants.map(tenant => <div className="cs-task" key={tenant.tenantId}><div><button className="cs-link" onClick={() => go(`/platform/tenants/${encodeURIComponent(tenant.tenantId)}`)}>{tenant.tenantName}</button><p>{tenant.legalName || tenant.slug || tenant.tenantId}</p></div><span aria-hidden>↗</span></div>)}
        {!loading && !error && !tenants.length && <p>Keine passenden Unternehmen.</p>}
        {tenants.length === 12 && <button className="cs-link" onClick={() => go('/platform/tenants')}>Unternehmensverzeichnis öffnen</button>}
      </section>}
    </ConsoleDialog>}
  </div>;
}
