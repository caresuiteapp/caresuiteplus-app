import { CompanyOrganizationWorkspace } from '@/components/company/CompanyOrganizationWorkspace.native';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
export default function CompanySectionRoute() { return <LiquidModuleRouteLayout><CompanyOrganizationWorkspace initialView="placements" /></LiquidModuleRouteLayout>; }
