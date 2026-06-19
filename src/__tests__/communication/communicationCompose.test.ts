import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createThread } from '@/features/communication/communication.service';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Kommunikationszentrum Compose (Sprint 45)', () => {
  it('CommunicationComposeHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/communication/CommunicationComposeHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).toContain('Neue Nachricht');
  });

  it('NewConversationScreen nutzt PremiumCard und SuccessState', () => {
    const source = readSrc('src/screens/communication/NewConversationScreen.tsx');
    expect(source).toContain('CommunicationComposeHero');
    expect(source).toContain('PremiumCard');
    expect(source).toContain('SuccessState');
    expect(source).not.toContain('service_role');
  });

  it('Compose-Route nutzt NewConversationScreen', () => {
    const source = readSrc('app/business/messages/new.tsx');
    expect(source).toContain('NewConversationScreen');
  });

  it('CommunicationCenterListView öffnet Compose als Modal', () => {
    const source = readSrc('src/components/communication/CommunicationCenterListView.tsx');
    expect(source).toContain('Neue Nachricht');
    expect(source).toContain('NewConversationModal');
    expect(source).toContain('canCreateThread');
  });

  it('NewConversationModal nutzt PlatformModal mit Gradient-Header', () => {
    const source = readSrc('src/components/communication/NewConversationModal.tsx');
    expect(source).toContain('PlatformModal');
    expect(source).toContain('Neue Nachricht');
    expect(source).toContain('Senden');
    expect(source).toContain('Schließen');
  });

  it('createThread persistiert Demo-Thread', async () => {
    const result = await createThread(
      DEMO_TENANT_ID,
      { threadType: 'internal', title: 'Sprint 45 Compose Test', isInternalOnly: false, isPortalVisible: false },
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Sprint 45 Compose Test');
    }
  });
});
