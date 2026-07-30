import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_ROUTES } from '@/lib/navigation/routes';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('CareSuite access hub redesign', () => {
  const hub = readSrc('src/liquid-command/screens/AccessHubScreen.tsx');

  it('uses the approved centered copy and larger CareSuite logo', () => {
    expect(hub).toContain('IHR ZUGANG');
    expect(hub).toContain('Wo möchten Sie starten?');
    expect(hub).toContain(
      'Wählen Sie den passenden Bereich und melden Sie sich sicher an.',
    );
    expect(hub).toContain('width: 560');
    expect(hub).toContain("textAlign: 'center'");
  });

  it('keeps the exact access order and matching character assets', () => {
    const employee = hub.indexOf("id: 'employee'");
    const client = hub.indexOf("id: 'client'");
    const administration = hub.indexOf("id: 'administration'");

    expect(employee).toBeGreaterThan(-1);
    expect(client).toBeGreaterThan(employee);
    expect(administration).toBeGreaterThan(client);
    expect(hub).toContain("access-employee.png");
    expect(hub).toContain("access-client.png");
    expect(hub).toContain("access-administration.png");
  });

  it('stacks below 900px and keeps company registration below the access cards', () => {
    expect(hub).toContain('const stacked = layout.width < 900');
    expect(hub.indexOf('<RegistrationCard')).toBeGreaterThan(
      hub.indexOf('ACCESS_OPTIONS.map'),
    );
    expect(hub).toContain('Firma / Unternehmen registrieren');
    expect(hub).toContain('CareSuite HealthOS für Ihre Organisation einrichten');
  });

  it('adds restrained motion and respects reduced-motion accessibility', () => {
    expect(hub).toContain('AccessibilityInfo.isReduceMotionEnabled');
    expect(hub).toContain("AccessibilityInfo.addEventListener('reduceMotionChanged'");
    expect(hub).toContain('AnimatedBackdrop');
    expect(hub).toContain('buttonShimmer');
    expect(hub).toContain('onHoverIn');
  });

  it('removes the standalone relatives portal and its access management route', () => {
    expect(hub).not.toContain('Angehörigenportal');
    expect(existsSync(path.join(root, 'app/auth/family-login.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'app/portal/relative/index.tsx'))).toBe(false);
    expect(
      existsSync(path.join(root, 'app/business/office/access/relative-portal/index.tsx')),
    ).toBe(false);
    expect(
      existsSync(path.join(root, 'app/business/office/portals/relatives.tsx')),
    ).toBe(false);
    expect(APP_ROUTES.some((route) => route.path.startsWith('/portal/relative'))).toBe(false);
    expect(
      APP_ROUTES.some((route) => route.path === '/business/office/access/relative-portal'),
    ).toBe(false);
  });
});
