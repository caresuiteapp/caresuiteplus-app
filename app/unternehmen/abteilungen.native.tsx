import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CompanyWorkspaceScreen } from "../../src/liquid-command/screens/CompanyWorkspaceScreen.native.tsx";
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
function CompanySectionRoute() {
    return <LiquidModuleRouteLayout><CompanyWorkspaceScreen initialTab="structure" initialView="departments"/></LiquidModuleRouteLayout>;
}
export default withNativeWorkflowPage(CompanySectionRoute);
