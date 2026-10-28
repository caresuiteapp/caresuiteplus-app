// Generated native presentation from src/hooks/usePageTab.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useGlobalSearchParams, useRouter } from 'expo-router';
/** Page sections belong to the address, so refreshing restores the selection. */
export function usePageTab<T extends string | null>(name: string, initial: T): [
    T,
    Dispatch<SetStateAction<T>>
] {
    const router = useRouter();
    const params = useGlobalSearchParams();
    const key = `csPage_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const [local, setLocal] = useState<T>(initial);
    const raw = params[key];
    const value = typeof raw === 'string' && raw.length <= 128 ? (raw === '~' ? null : raw) as T : local;
    const current = useRef(value);
    current.current = value;
    const select: Dispatch<SetStateAction<T>> = useCallback(action => {
        const next = typeof action === 'function' ? action(current.current) : action;
        if (next === current.current)
            return;
        current.current = next;
        setLocal(next);
        router.setParams({ [key]: next ?? '~' });
    }, [key, router]);
    return [value, select];
}
