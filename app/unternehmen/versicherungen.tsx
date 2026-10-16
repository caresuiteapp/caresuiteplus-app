import { CompanyResourcesWorkspace } from '@/components/company/CompanyResourcesWorkspace.native';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
export default function CompanySectionRoute() { return <LiquidModuleRouteLayout><CompanyResourcesWorkspace initialView="insurance" /></LiquidModuleRouteLayout>; }
