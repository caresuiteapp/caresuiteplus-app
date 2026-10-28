import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CompanyWorkspaceScreen } from "../../src/liquid-command/screens/CompanyWorkspaceScreen.native.tsx";
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
function CompanyInventoryRoute() {
    return <LiquidModuleRouteLayout><CompanyWorkspaceScreen initialTab="inventory"/></LiquidModuleRouteLayout>;
}
export default withNativeWorkflowPage(CompanyInventoryRoute);
