import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R16 portal mobile stability and layout recovery', () => {
  it('centers the employee/client access start on phones', () => {
    const hub = read('src/liquid-command/screens/AccessHubBaseScreen.tsx');
    expect(hub).toMatch(/scrollContentStacked:\s*\{[\s\S]*justifyContent: 'center'/);
    expect(hub).toContain('<LiquidLogo width={stacked ? 286 : 560} />');
  });

  it('uses a contrast-safe HealthOS wordmark on light portal chrome', () => {
    const primitives = read('src/liquid-command/components/LiquidPrimitives.tsx');
    expect(primitives).toContain("color: '#0B2A4A'");
    expect(primitives).toContain("color: '#1683FF'");
    expect(primitives).toContain('CareSuite<Text style={styles.orbitWordmarkAccent}> HealthOS</Text>');
  });

  it('keeps the bottom navigation and menu above Android system controls', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(shell).toContain('bottomNavigationOffset');
    expect(shell).toContain('Math.max(insets.bottom, 12) + (layout.isPhone ? 16 : 12)');
    expect(shell).toContain('menuBottomPadding');
    expect(shell).toContain("maxHeight: '72%'");
  });

  it('renders a complete welcome card without a forced phone height', () => {
    const welcome = read('src/components/auth/PortalWelcomeModal.tsx');
    expect(welcome).not.toContain('minHeight: 430');
    expect(welcome).toContain('maxHeightRatio={0.88}');
    expect(welcome).toContain("title: 'Zur Übersicht'");
    expect(welcome).toContain('CareSuite HealthOS');
  });

  it('never overlays token registration failures on portal navigation', () => {
    const gate = read('src/components/portal/PortalPushRegistrationGate.tsx');
    expect(gate).not.toContain('retryBanner');
    expect(gate).not.toContain('Benachrichtigungen werden eingerichtet');
    expect(gate).toContain('if (!permissionMissing) return null;');
  });
});
