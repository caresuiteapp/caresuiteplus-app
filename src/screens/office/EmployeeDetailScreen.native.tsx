// Generated native presentation from src/screens/office/EmployeeDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { EmployeePersonnelFilePanel } from "../../components/office/EmployeePersonnelFilePanel.native.tsx";
import { resolvePersonnelUiTab, type PersonnelUiTabKey } from '@/lib/office/employeePersonnelLabels';
type Props = {
    employeeId?: string;
    embedded?: boolean;
    embeddedInModal?: boolean;
    initialTabOverride?: 'uebersicht' | 'stammdaten' | 'kontakt' | 'anstellung' | 'portal';
    onDeleted?: () => void;
    onEditMasterData?: () => void;
    onOpenPersonnelRecord?: () => void;
    onOpenOffboarding?: () => void;
};
const tabMap: Record<NonNullable<Props['initialTabOverride']>, PersonnelUiTabKey> = { uebersicht: 'overview', stammdaten: 'master_data', kontakt: 'contact', anstellung: 'employment', portal: 'portal' };
export function EmployeeDetailScreen({ employeeId, embedded = false, initialTabOverride, ...props }: Props = {}) {
    const { id, tab } = useLocalSearchParams<{
        id?: string;
        tab?: string;
    }>();
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    const recordId = employeeId ?? id;
    const content = recordId ? <NativeDiv className="pe-record-container"><EmployeePersonnelFilePanel key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}:${recordId}`} employeeId={recordId} initialTab={initialTabOverride ? tabMap[initialTabOverride] : resolvePersonnelUiTab(tab ?? 'overview')} {...props}/></NativeDiv> : <NativeDiv className="pe-empty" role="alert">Die Personalakte wurde nicht gefunden.</NativeDiv>;
    return embedded ? content : <ScreenShell title="Personalakte" subtitle="Personal · Office" scroll={false}>{content}</ScreenShell>;
}
