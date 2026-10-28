import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ConsultationWorkspaceScreen } from "../../../src/features/beratung/ConsultationWorkspaceScreen.native.tsx";
function ConsultationOfficeRoute() { return <ConsultationWorkspaceScreen />; }
export default withNativeWorkflowPage(ConsultationOfficeRoute);
