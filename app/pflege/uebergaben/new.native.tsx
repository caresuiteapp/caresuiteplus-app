import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CaseHandoverWorkspace } from "../../../src/screens/pflege/CaseHandoverWorkspace.native.tsx";
function NewCaseHandoverRoute() { return <CaseHandoverWorkspace mode="new"/>; }
export default withNativeWorkflowPage(NewCaseHandoverRoute);
