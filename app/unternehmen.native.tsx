import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CompanyWorkspaceScreen } from "../src/liquid-command/screens/CompanyWorkspaceScreen.native.tsx";
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
function CompanyRoute() {
    return (<LiquidModuleRouteLayout>
      <CompanyWorkspaceScreen />
    </LiquidModuleRouteLayout>);
}
export default withNativeWorkflowPage(CompanyRoute);
