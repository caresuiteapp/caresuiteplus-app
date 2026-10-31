// Generated native presentation from src/screens/templates/TemplateSettingsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeButton,NativeSection,NativeLabel,NativeSpan,NativeInput,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getTenantTemplateSettings, updateTenantTemplateSettings } from '@/lib/templates';
import { TemplateAccessMessage, TemplateWorkspaceFrame } from "../../components/templates/TemplateWorkspace.native.tsx";
export function TemplateSettingsScreen() {
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const current = useRef(`${tenantId}:${profile?.roleKey}`);
    current.current = `${tenantId}:${profile?.roleKey}`;
    const writeLock = useRef<string | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { writeLock.current = null; setSaving(false); setMessage(''); setError(''); }, [tenantId, profile?.roleKey]);
    const query = useAsyncQuery(() => getTenantTemplateSettings(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && can('office.catalogs.view'), queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    async function toggle(key: 'allowTenantOverrides' | 'showSystemTemplates', value: boolean) { if (!tenantId || saving || !can('office.catalogs.edit') || writeLock.current === current.current)
        return; const scope = current.current; writeLock.current = scope; setSaving(true); setError(''); setMessage(''); try {
        const result = await updateTenantTemplateSettings(tenantId, { [key]: value }, profile?.roleKey);
        if (!mounted.current || current.current !== scope)
            return;
        if (result.ok) {
            query.setData(result.data);
            setMessage('Einstellung gespeichert.');
        }
        else
            setError(result.error);
    }
    catch {
        if (mounted.current && current.current === scope)
            setError('Einstellung konnte nicht gespeichert werden.');
    }
    finally {
        if (writeLock.current === scope)
            writeLock.current = null;
        if (mounted.current && current.current === scope)
            setSaving(false);
    } }
    return <TemplateWorkspaceFrame title="Einstellungen für Textvorlagen" description="Vorgaben für Ihre eigenen Text- und Nachrichtenvorlagen.">
    {!can('office.catalogs.view') ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Einstellungen werden geladen …</NativeDiv> : query.error && !query.data ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : query.data ? <NativeSection className="dw-panel"><NativeLabel className="dw-field"><NativeSpan><NativeInput type="checkbox" checked={query.data.allowTenantOverrides} disabled={saving || !can('office.catalogs.edit')} onChange={e => void toggle('allowTenantOverrides', e.target.checked)}/> Eigene Anpassungen erlauben</NativeSpan><NativeSpan className="dw-muted">Standardtexte als eigene Vorlagen ergänzen.</NativeSpan></NativeLabel><NativeLabel className="dw-field"><NativeSpan><NativeInput type="checkbox" checked={query.data.showSystemTemplates} disabled={saving || !can('office.catalogs.edit')} onChange={e => void toggle('showSystemTemplates', e.target.checked)}/> Standard-Textvorlagen anzeigen</NativeSpan><NativeSpan className="dw-muted">Gilt für Textvorlagen. Der Dokumentenkatalog bleibt separat verfügbar.</NativeSpan></NativeLabel><NativeP className="dw-muted">Sprache: {query.data.defaultLocale === 'de-DE' ? 'Deutsch (Deutschland)' : query.data.defaultLocale}</NativeP>{saving ? <NativeP role="status">Wird gespeichert …</NativeP> : null}{message ? <NativeDiv className="dw-alert" data-tone="success" role="status">{message}</NativeDiv> : null}{error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error}</NativeDiv> : null}</NativeSection> : null}
  </TemplateWorkspaceFrame>;
}
