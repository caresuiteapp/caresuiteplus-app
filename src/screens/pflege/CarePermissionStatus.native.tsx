// Generated native presentation from src/screens/pflege/CarePermissionStatus.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { ErrorState, LoadingState } from '@/components/ui';
export type CarePermissionStatusState = {
    loading: boolean;
    error: string | null;
    refreshPermissions: () => void;
};
export function CarePermissionStatus({ state }: {
    state: CarePermissionStatusState;
}) {
    if (state.loading)
        return <LoadingState message="Aktuelle Pflegeberechtigungen werden geprüft…"/>;
    return <ErrorState message={state.error ?? 'Die aktuelle Leseberechtigung ist nicht verfügbar.'} onRetry={state.error ? state.refreshPermissions : undefined}/>;
}
