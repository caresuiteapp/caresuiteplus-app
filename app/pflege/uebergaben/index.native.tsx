import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CaseHandoverWorkspace } from "../../../src/screens/pflege/CaseHandoverWorkspace.native.tsx";
function CaseHandoversRoute() { return <CaseHandoverWorkspace />; }
export default withNativeWorkflowPage(CaseHandoversRoute);
