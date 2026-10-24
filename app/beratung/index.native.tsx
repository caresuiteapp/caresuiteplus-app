import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { Redirect } from 'expo-router';
function BeratungWebIndexRoute() {
    return <Redirect href="/beratung/arbeitsplatz"/>;
}
export default withNativeWorkflowPage(BeratungWebIndexRoute);
