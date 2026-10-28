// Generated native presentation from src/components/platformConsole/PlatformGlobalSearch.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeSmall,NativeLabel,NativeInput,NativeSection,NativeH3,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { SemanticArtwork } from "../icons/SemanticArtwork.native.tsx";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from "../../lib/platformConsole/platformCapabilities.native.ts";
import { PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';
import { listPlatformCompanies } from '@/lib/platformConsole/platformCompanyDirectoryService';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { ConsoleDialog, ConsoleStyle } from "./ConsoleWorkspaceUi.native.tsx";
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
                event.preventDefault();
                show();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);
    useEffect(() => {
        if (!open || !canReadTenants) {
            setTenants([]);
            setLoading(false);
            return;
        }
        let active = true;
        setLoading(true);
        setError('');
        setTenants([]);
        const timer = setTimeout(async () => {
            try {
                const result = await listPlatformCompanies({ search: query.trim() || undefined, limit: 12 });
                if (!result.ok)
                    throw new Error(result.error);
                if (active)
                    setTenants(result.data.items);
            }
            catch (cause) {
                if (active)
                    setError(cause instanceof Error ? cause.message : 'Die Unternehmenssuche ist nicht erreichbar.');
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }, 200);
        return () => { active = false; clearTimeout(timer); };
    }, [open, query, canReadTenants]);
    const pages = useMemo(() => PLATFORM_NAV_ITEMS.filter(item => (!item.capability || platformRoleHasCapability(role, item.capability)) &&
        item.label.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'))), [query, role]);
    const go = (path: string) => { setOpen(false); router.push(path as never); };
    return <NativeDiv className="cs-console"><ConsoleStyle />
    <NativeButton className="cs-btn" onClick={show} aria-label="Plattform durchsuchen, Strg oder Command K"><SemanticArtwork webSize={20}>⌕</SemanticArtwork> Suchen <NativeSmall>Strg K</NativeSmall></NativeButton>
    {open && <ConsoleDialog title="Plattform durchsuchen" description="Verfügbare Arbeitsbereiche und registrierte Unternehmen finden." onClose={() => setOpen(false)}>
      <NativeLabel className="cs-field">Suchbegriff<NativeInput autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Unternehmen, E-Mail oder Arbeitsbereich"/></NativeLabel>
      <NativeSection><NativeH3>Arbeitsbereiche</NativeH3><NativeDiv className="cs-actions">{pages.map(item => <NativeButton key={item.path} className="cs-btn" onClick={() => go(item.path)}><SemanticArtwork webSize={20}>{item.icon}</SemanticArtwork> {item.label}</NativeButton>)}</NativeDiv>{!pages.length && <NativeP>Keine passenden Arbeitsbereiche.</NativeP>}</NativeSection>
      {canReadTenants && <NativeSection><NativeH3>Unternehmen</NativeH3>{loading && <NativeP role="status">Unternehmen werden gesucht…</NativeP>}{error && <NativeP className="cs-notice error" role="alert">{error}</NativeP>}
        {tenants.map(tenant => <NativeDiv className="cs-task" key={tenant.tenantId}><NativeDiv><NativeButton className="cs-link" onClick={() => go(`/platform/tenants/${encodeURIComponent(tenant.tenantId)}`)}>{tenant.tenantName}</NativeButton><NativeP>{tenant.legalName || tenant.slug || 'Unternehmen'} · Kostenlos</NativeP></NativeDiv><SemanticArtwork webSize={20}>↗</SemanticArtwork></NativeDiv>)}
        {!loading && !error && !tenants.length && <NativeP>Keine passenden Unternehmen.</NativeP>}
        {tenants.length === 12 && <NativeButton className="cs-link" onClick={() => go('/platform/tenants')}>Unternehmensverzeichnis öffnen</NativeButton>}
      </NativeSection>}
    </ConsoleDialog>}
  </NativeDiv>;
}
