import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Mobile Portal Spatial V34.4', () => {
  it('uses dedicated spatial portal surfaces instead of generic white HealthOS sections', () => {
    const dashboard = read('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx');
    expect(dashboard).toContain('SpatialPortalSection');
    expect(dashboard).toContain('SpatialPortalMetric');
    expect(dashboard).toContain('SpatialPortalPearlState');
    expect(dashboard).not.toContain('<HealthOSSection');
    expect(dashboard).not.toContain('<HealthOSMetricCard');
  });

  it('defines a dark layered stage with cyan light and pearl sheets', () => {
    const surface = read('src/components/portal/SpatialPortalSurface.tsx');
    expect(surface).toContain("rgba(63,64,101,0.94)");
    expect(surface).toContain('spatialObjectCore');
    expect(surface).toContain("rgba(244,241,249,0.98)");
    expect(surface).toContain('SpatialPortalPearlState');
  });

  it('keeps drawer copy explicitly readable and navigation floating', () => {
    const drawer = read('src/components/layout/portal/PortalNavigationDrawer.tsx');
    const nav = read('src/components/layout/PortalMobileNav.tsx');
    expect(drawer).toContain("primary: '#FFFFFF'");
    expect(drawer).toContain("width: '80%'");
    expect(nav).toContain('borderRadius: 24');
    expect(nav).toContain('marginHorizontal: 12');
  });
});
