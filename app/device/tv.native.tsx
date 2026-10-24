import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { useRouter } from 'expo-router';
import { TvDeviceLogin } from "../../src/components/auth/TvDeviceLogin.native.tsx";
/** Outside the automatic home redirect so session installation can finish atomically. */
function TvLoginRoute() {
    const router = useRouter();
    return <TvDeviceLogin onExit={() => router.replace('/' as never)}/>;
}
export default withNativeWorkflowPage(TvLoginRoute);
