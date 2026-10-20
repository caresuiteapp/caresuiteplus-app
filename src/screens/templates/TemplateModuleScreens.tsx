import { TemplateListScreenBase } from './TemplateListScreenBase';

export function SystemTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Systemvorlagen"
      subtitle="CareSuite+ Standardvorlagen"
      baseFilters={{ scope: 'system', status: 'active' }}
      showCreate={false}
    />
  );
}

export function TenantTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Mandantenvorlagen"
      subtitle="Eigene Anpassungen"
      baseFilters={{ scope: 'tenant' }}
    />
  );
}

export function TextBlocksScreen() {
  return (
    <TemplateListScreenBase
      title="Textbausteine"
      subtitle="Dokumentation & Nachrichten"
      baseFilters={{ templateType: 'documentation_text', status: 'active' }}
      listHeroModule="text-blocks"
    />
  );
}

export function DocumentTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Dokumentvorlagen"
      subtitle="Office & Dokumente"
      baseFilters={{ templateType: 'document', status: 'active' }}
      listHeroModule="document-templates"
    />
  );
}

export function MessageTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Nachrichten-Vorlagen"
      subtitle="Kommunikation"
      baseFilters={{ moduleKey: 'communication', templateType: 'message', status: 'active' }}
      listHeroModule="message-templates"
    />
  );
}

export function BillingTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Abrechnungsvorlagen"
      subtitle="Rechnung & Mahnung"
      baseFilters={{ moduleKey: 'billing', status: 'active' }}
      listHeroModule="billing-templates"
    />
  );
}

export function CareTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Pflege-Vorlagen"
      subtitle="SIS, Pflegeplan, Risiko"
      baseFilters={{ moduleKey: 'pflege', status: 'active' }}
      listHeroModule="care-templates"
    />
  );
}

export function CounselingTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Beratungs-Vorlagen"
      subtitle="Protokolle & Checklisten"
      baseFilters={{ moduleKey: 'beratung', status: 'active' }}
      listHeroModule="counseling-templates"
    />
  );
}

export function AcademyTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Akademie-Vorlagen"
      subtitle="Kurse & Zertifikate"
      baseFilters={{ moduleKey: 'akademie', status: 'active' }}
      listHeroModule="academy-templates"
    />
  );
}

export function ConsentTemplatesScreen() {
  return (
    <TemplateListScreenBase
      title="Einwilligungen"
      subtitle="Consent & Datenschutz"
      baseFilters={{ templateType: 'consent', status: 'active' }}
      listHeroModule="consent-templates"
    />
  );
}
