// Generated native presentation from src/screens/pflege/CarePermissionStatus.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { ErrorState, LoadingState } from '@/components/ui';
export type CarePermissionStatusState = {
    loading: boolean;
    error: string | null;
    refreshPermissions: () => void;
};
export function CarePermissionStatus({ state, deniedMessage = 'Für diese Pflegeansicht fehlt die Leseberechtigung.', }: {
    state: CarePermissionStatusState;
    deniedMessage?: string;
}) {
    if (state.loading)
        return <LoadingState presentation="inline" message="Pflegeberechtigungen werden geprüft…"/>;
    return <ErrorState presentation="inline" message={state.error ?? deniedMessage} onRetry={state.error ? state.refreshPermissions : undefined}/>;
}
