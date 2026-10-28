import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { Redirect, useLocalSearchParams } from 'expo-router';
function OfficeMessageDetailRoute() {
    const { id, threadId, thread, ...params } = useLocalSearchParams<Record<string, string | string[]>>();
    return <Redirect href={{ pathname: '/office/messages', params: { ...params, thread: thread ?? threadId ?? id } }}/>;
}
export default withNativeWorkflowPage(OfficeMessageDetailRoute);
