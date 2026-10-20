import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CLIENT_HELP_CONTACTS } from '@/lib/portal/clientHelpContacts';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('client portal premium and senior experience R23', () => {
  it('uses the client access character as a friendly portal guide', () => {
    const guide = read('src/components/portal/ClientPortalGuide.tsx');
    expect(guide).toContain("access-client.png");
    expect(guide).toContain('bubble');
    expect(guide).toContain('accessibilityLabel="CareSuite Portalbegleiter"');
  });

  it('renders client routes in their own responsive premium page frame', () => {
    const screen = read('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain('ClientPortalPageFrame');
    expect(screen).toContain("pathname.startsWith('/portal/client')");
    expect(screen).toContain('client-portal-tab-screen');
  });

  it('keeps upcoming and past appointments in selectable views', () => {
    const appointments = read('src/components/portal/PortalAppointmentsTab.tsx');
    expect(appointments).toContain("useState<'upcoming' | 'past'>('upcoming')");
    expect(appointments).toContain('Kommend (');
    expect(appointments).toContain('Vergangen (');
    expect(appointments).toContain('clientVisibleItems');
  });

  it('provides persistent text sizing up to 150 percent in client navigation', () => {
    const provider = read('src/design/web/WebFontScaleProvider.tsx');
    const config = read('src/design/web/webFontScaleConfig.ts');
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(config).toContain('1.5');
    expect(provider).toContain('reset');
    expect(shell).toContain('PortalTextSizeControls');
    expect(shell).toContain("kind === 'client'");
  });

  it('contains nationwide official help numbers and all seven poison centres', () => {
    const numbers = CLIENT_HELP_CONTACTS.map((item) => item.dialNumber).filter(Boolean);
    expect(numbers).toEqual(expect.arrayContaining(['110', '112', '116117', '116123', '116016', '116006', '116111', '116116']));
    expect(CLIENT_HELP_CONTACTS.filter((item) => item.id.startsWith('poison-'))).toHaveLength(7);
    expect(CLIENT_HELP_CONTACTS.every((item) => item.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('delivers signature requests live and removes role jargon from client cards', () => {
    const screen = read('src/screens/portal/ClientDocumentSignaturesScreen.tsx');
    const realtime = read('src/lib/realtime/presets.ts');
    const card = read('src/components/office/documentSignatures/CsDocumentRequestCard.tsx');
    const detail = read('src/screens/documents/CsDocumentRequestDetailScreen.tsx');
    const service = read('src/lib/documents/csTemplates/csDocumentRequestService.ts');
    expect(screen).toContain('subscribeToClientPortalDocumentRequestChanges');
    expect(realtime).toContain("table: 'cs_document_requests'");
    expect(card).toContain('Ihre Unterschrift fehlt noch');
    expect(detail).toContain('autoOpenedRequestRef');
    expect(detail).not.toContain('Als geöffnet markieren');
    expect(detail).toContain('fetchPortalCsDocumentRequestDetail');
    expect(service).toContain('portalActor');
    expect(service).toContain('portal_visible: true');
  });
});
