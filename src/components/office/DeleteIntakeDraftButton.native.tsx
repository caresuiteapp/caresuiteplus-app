// Generated native presentation from src/components/office/DeleteIntakeDraftButton.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeButton,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { confirmAction } from '@/lib/platform/confirmAction';
import { clearClientIntakeDraft } from '@/lib/clients/clientIntakeDraftStorage';
import { deleteClientIntakeDraft, loadServerClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
export function DeleteIntakeDraftButton({ clientId, name, onDeleted }: {
    clientId: string;
    name: string;
    onDeleted: () => void;
}) {
    const { user, profile } = useAuth();
    const tenantId = useServiceTenantId();
    const userId = user?.id ?? profile?.id;
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false), alive = useRef(true);
    const scope = `${tenantId}:${userId}:${clientId}`, active = useRef(scope);
    active.current = scope;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { lock.current = false; setBusy(false); setError(''); }, [scope]);
    async function remove() {
        if (lock.current || !tenantId || !userId)
            return;
        const started = scope;
        const current = () => alive.current && active.current === started;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const draft = await loadServerClientIntakeDraft(tenantId, clientId);
            if (!current())
                return;
            if (!draft.ok && !draft.deleted)
                throw new Error(draft.error);
            if (draft.ok && draft.data?.status === 'completed')
                throw new Error('Diese Aufnahme wurde bereits abgeschlossen und kann hier nicht gelöscht werden.');
            if (!draft.deleted) {
                const confirmed = await confirmAction({ title: 'Aufnahmeentwurf löschen', message: `Den Entwurf für „${name}“ löschen? Ein zugehöriger Ersttermin wird ebenfalls aus dem Kalender entfernt. Abgeschlossene Akten und Originale bleiben erhalten.`, confirmLabel: 'Entwurf löschen', cancelLabel: 'Behalten' });
                if (!current() || !confirmed)
                    return;
                const result = await deleteClientIntakeDraft(tenantId, clientId, draft.ok ? draft.data?.revision ?? 0 : 0);
                if (!current())
                    return;
                if (!result.ok)
                    throw new Error(result.error);
            }
            await clearClientIntakeDraft(userId, tenantId, clientId);
            if (current())
                onDeleted();
        }
        catch (cause) {
            if (current())
                setError(cause instanceof Error ? cause.message : 'Die Löschung konnte nicht bestätigt werden.');
        }
        finally {
            if (current()) {
                lock.current = false;
                setBusy(false);
            }
        }
    }
    return <NativeDiv className="cs-records-delete"><NativeButton type="button" disabled={busy} onClick={() => void remove()} aria-label={`Entwurf von ${name} löschen`}>{busy ? 'Wird geprüft …' : 'Entwurf löschen'}</NativeButton>{error ? <NativeP role="alert">{error}</NativeP> : null}</NativeDiv>;
}
