// Generated native presentation from src/screens/templates/TemplateModuleScreens.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { Redirect } from 'expo-router';
import { TemplateListScreenBase } from "./TemplateListScreenBase.native.tsx";
export function SystemTemplatesScreen() { return <Redirect href="/business/office/document-catalog"/>; }
export function TenantTemplatesScreen() { return <TemplateListScreenBase title="Eigene Textvorlagen" subtitle="Ihre gespeicherten Bausteine für Dokumentation, Nachrichten und Geschäftstexte." baseFilters={{ scope: 'tenant' }}/>; }
export function TextBlocksScreen() { return <TemplateListScreenBase title="Textbausteine" subtitle="Wiederkehrende Formulierungen für die Dokumentation." baseFilters={{ templateType: 'documentation_text' }}/>; }
export function MessageTemplatesScreen() { return <TemplateListScreenBase title="Nachrichtenvorlagen" subtitle="Wiederkehrende Nachrichten vorbereiten und passend ergänzen." baseFilters={{ moduleKey: 'communication', templateType: 'message' }}/>; }
export function DocumentTemplatesScreen() { return <Redirect href="/business/office/document-catalog"/>; }
export function BillingTemplatesScreen() { return <Redirect href="/business/office/document-catalog?category=abrechnung"/>; }
export function CareTemplatesScreen() { return <Redirect href="/business/office/document-catalog?module=pflege"/>; }
export function CounselingTemplatesScreen() { return <Redirect href="/business/office/document-catalog?module=beratung"/>; }
export function AcademyTemplatesScreen() { return <Redirect href="/business/office/document-catalog?category=personal"/>; }
export function ConsentTemplatesScreen() { return <Redirect href="/business/office/document-catalog?category=vollmachten"/>; }
