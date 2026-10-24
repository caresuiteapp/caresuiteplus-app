import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ConsultationWorkspaceScreen } from "../../../../src/features/beratung/ConsultationWorkspaceScreen.native.tsx";
function EmployeeConsultationRoute() { return <ConsultationWorkspaceScreen employeeView/>; }
export default withNativeWorkflowPage(EmployeeConsultationRoute);
