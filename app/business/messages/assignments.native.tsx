import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { Redirect } from 'expo-router';
function CommunicationAssignmentsRoute() { return <Redirect href="/business/messages?filter=mine"/>; }
export default withNativeWorkflowPage(CommunicationAssignmentsRoute);
