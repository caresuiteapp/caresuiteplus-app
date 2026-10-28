import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { useRouter } from 'expo-router';
import { ClientsListScreen } from "../../src/screens/office/ClientsListScreen.native.tsx";
function PflegeClientsRoute() {
    const router = useRouter();
    return <ClientsListScreen moduleLabel="Pflege" contextLabel="Klient:innen mit vollständiger Pflegeakte" useModals={false} onClientPress={id => router.push({ pathname: '/pflege/klienten/[id]', params: { id } } as never)}/>;
}
export default withNativeWorkflowPage(PflegeClientsRoute);
