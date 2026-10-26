// Generated native presentation from src/hooks/useBudgetRecordTabs.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
/** Local record tabs do not remove a route, so budget drafts need an explicit guard. */
export function useBudgetRecordTabs({ tabs, initialTab, requestedTab, storedUrlTab }: {
    tabs: ClientRecordTabKey[];
    initialTab: ClientRecordTabKey;
    requestedTab?: ClientRecordTabKey;
    storedUrlTab?: ClientRecordTabKey;
}) {
    const router = useRouter();
    const [committed, setCommitted] = useState(initialTab);
    const [notice, setNotice] = useState('');
    const activeTab = tabs.includes(committed) ? committed : initialTab;
    const current = useRef(activeTab);
    current.current = activeTab;
    const allowed = useRef(tabs);
    allowed.current = tabs;
    const dirty = useRef(false);
    const busy = useRef(false);
    const sequence = useRef(0);
    const alive = useRef(true);
    const incoming = useRef<{
        requested?: ClientRecordTabKey;
        stored?: ClientRecordTabKey;
        tabKeys: string;
    } | null>(null);
    const tabKeys = tabs.join(',');
    useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
    const onBudgetDirtyChange = useCallback((value: boolean) => { dirty.current = value; }, []);
    const onBudgetBusyChange = useCallback((value: boolean) => { busy.current = value; }, []);
    const writeAddress = useCallback((tab: ClientRecordTabKey) => {
        router.setParams({ tab, csPage_ClientRecordScreen_activeTab: tab });
    }, [router]);
    const requestTab = useCallback(async (next: ClientRecordTabKey, fromUrl = false) => {
        if (!allowed.current.includes(next) || current.current === next)
            return;
        const request = ++sequence.current;
        if (busy.current) {
            setNotice('Bitte schließen Sie zuerst die Budgetbearbeitung oder warten Sie, bis das Speichern beendet ist.');
            if (fromUrl)
                writeAddress(current.current);
            return;
        }
        if (dirty.current) {
            const accepted = await confirmAction({ title: 'Aktenbereich wechseln?', message: 'Die Abrechnungsquellen wurden noch nicht gespeichert. Möchten Sie die Änderungen verwerfen und den Bereich wechseln?', confirmLabel: 'Verwerfen und wechseln', cancelLabel: 'Weiter bearbeiten' });
            if (!alive.current || request !== sequence.current)
                return;
            if (!accepted) {
                if (fromUrl)
                    writeAddress(current.current);
                return;
            }
        }
        if (!alive.current || request !== sequence.current || !allowed.current.includes(next))
            return;
        if (busy.current) {
            setNotice('Bitte warten Sie, bis das Speichern beendet ist.');
            if (fromUrl)
                writeAddress(current.current);
            return;
        }
        dirty.current = false;
        busy.current = false;
        current.current = next;
        setCommitted(next);
        setNotice('');
        writeAddress(next);
    }, [writeAddress]);
    const selectTab = useCallback((next: ClientRecordTabKey) => { void requestTab(next); }, [requestTab]);
    useEffect(() => {
        if (!allowed.current.length)
            return;
        const previous = incoming.current;
        if (previous && previous.requested === requestedTab && previous.stored === storedUrlTab && previous.tabKeys === tabKeys)
            return;
        incoming.current = { requested: requestedTab, stored: storedUrlTab, tabKeys };
        const requestedChanged = !previous || previous.requested !== requestedTab;
        const next = requestedChanged ? (requestedTab ?? storedUrlTab ?? initialTab) : (storedUrlTab ?? requestedTab ?? initialTab);
        if (allowed.current.includes(next))
            void requestTab(next, true);
    }, [tabKeys, requestedTab, storedUrlTab, initialTab, requestTab]);
    return { activeTab, selectTab, onBudgetDirtyChange, onBudgetBusyChange, budgetNavigationNotice: notice };
}
