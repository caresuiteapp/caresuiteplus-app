import type { IntegrationCategory, IntegrationProvider } from '@/types/modules/integrations';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export type ProviderDefinition = {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Referenz auf Vault/Edge — niemals ein echter Secret-Wert */
  secretReferenceKey: string;
  supportsOcr: boolean;
  supportsAi: boolean;
};

/**
 * Registry bekannter Integrations- und KI/OCR-Anbieter.
 * Secrets werden ausschließlich über secret_reference in Supabase Vault gehalten.
 */
export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    key: 'datev',
    name: 'DATEV',
    category: 'accounting',
    description: 'Buchhaltungs-Export und Rechnungsübergabe',
    secretReferenceKey: 'vault:integration-datev',
    supportsOcr: false,
    supportsAi: false,
  },
  {
    key: 'lexoffice',
    name: 'Lexoffice',
    category: 'accounting',
    description: 'Cloud-Buchhaltung für KMU',
    secretReferenceKey: 'vault:integration-lexoffice',
    supportsOcr: false,
    supportsAi: false,
  },
  {
    key: 'azure-document-intelligence',
    name: 'Azure Document Intelligence',
    category: 'storage',
    description: 'OCR und Dokumentenklassifikation',
    secretReferenceKey: 'vault:integration-azure-di',
    supportsOcr: true,
    supportsAi: true,
  },
  {
    key: 'openai',
    name: 'OpenAI',
    category: 'other',
    description: 'KI-gestützte Textzusammenfassung und Assistenz',
    secretReferenceKey: 'vault:integration-openai',
    supportsOcr: false,
    supportsAi: true,
  },
  {
    key: 'twilio',
    name: 'Twilio',
    category: 'messaging',
    description: 'SMS und Benachrichtigungen',
    secretReferenceKey: 'vault:integration-twilio',
    supportsOcr: false,
    supportsAi: false,
  },
  {
    key: 'personio-payroll',
    name: 'Personio Lohn',
    category: 'hr',
    description: 'Lohnexport und HR-Stammdaten (WP 482)',
    secretReferenceKey: 'vault:integration-personio',
    supportsOcr: false,
    supportsAi: false,
  },
  {
    key: 'datev-payroll',
    name: 'DATEV Lohn & Gehalt',
    category: 'hr',
    description: 'Lohnbuchhaltung und SV-Meldungen',
    secretReferenceKey: 'vault:integration-datev-payroll',
    supportsOcr: false,
    supportsAi: false,
  },
];

export function getProviderByKey(key: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((p) => p.key === key);
}

export function getProvidersByCategory(
  category: IntegrationCategory,
): ProviderDefinition[] {
  return PROVIDER_REGISTRY.filter((p) => p.category === category);
}

export function getOcrProviders(): ProviderDefinition[] {
  return PROVIDER_REGISTRY.filter((p) => p.supportsOcr);
}

export function getAiProviders(): ProviderDefinition[] {
  return PROVIDER_REGISTRY.filter((p) => p.supportsAi);
}

/** Demo-Konfiguration — zeigt secret_reference ohne echte Werte */
export function buildDemoProviderInstances(): Pick<
  IntegrationProvider,
  'id' | 'tenantId' | 'name' | 'category' | 'status' | 'secretReference' | 'configuredAt'
>[] {
  return [
    {
      id: 'int-001',
      tenantId: DEMO_TENANT_ID,
      name: 'Azure Document Intelligence',
      category: 'storage',
      status: 'active',
      secretReference: 'vault:integration-azure-di',
      configuredAt: '2026-01-15T08:00:00.000Z',
    },
    {
      id: 'int-002',
      tenantId: DEMO_TENANT_ID,
      name: 'OpenAI',
      category: 'other',
      status: 'pending_setup',
      secretReference: null,
      configuredAt: null,
    },
  ];
}

export function resolveSecretReference(
  providerKey: string,
): string | null {
  const provider = getProviderByKey(providerKey);
  return provider?.secretReferenceKey ?? null;
}
