import { describe, expect, it } from 'vitest';
import { CONNECT_CATALOG, getConnectIntegration } from '@/lib/connect/connectCatalog';
import { PROVIDER_REGISTRY } from '@/lib/integrations/providerRegistry';

describe('Google Workspace integration registration', () => {
  it('is a visible live-capable Connect entry with a dedicated management route', () => {
    const integration = getConnectIntegration('communication_channels', 'google_workspace');
    expect(integration).toMatchObject({
      key: 'google_workspace',
      label: 'Google Workspace',
      readiness: 'beta',
      requiresProvider: true,
      moduleHref: '/business/connect/google-workspace',
    });
  });

  it('registers all collaboration services in the product copy', () => {
    const integration = getConnectIntegration('communication_channels', 'google_workspace');
    for (const service of [
      'Gmail',
      'Kalender',
      'Meet',
      'Drive',
      'Docs',
      'Sheets',
      'Slides',
      'Chat',
      'Tasks',
      'Kontakte',
    ]) {
      expect(integration?.description).toContain(service);
    }
  });

  it('keeps Google Workspace in the common provider registry without embedding secrets', () => {
    const provider = PROVIDER_REGISTRY.find((entry) => entry.key === 'google-workspace');
    expect(provider?.secretReferenceKey).toBe('vault:integration-google-workspace-oauth');
    expect(provider?.secretReferenceKey).not.toMatch(/client_secret|AIza|GOCSPX/i);
  });

  it('marks the communication category as available', () => {
    const category = CONNECT_CATALOG.find((entry) => entry.key === 'communication_channels');
    expect(category?.readiness).toBe('beta');
  });
});
