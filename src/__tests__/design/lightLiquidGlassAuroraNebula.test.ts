import { describe, expect, it } from 'vitest';

import {

  getLlganCssVars,

  llganAuroraWisps,

  llganCssVars,

  llganGlassSurface,

  llganIntensityPresets,

  llganModuleCardGlow,

  llganNebulaClouds,

  llganPearlescentGlows,

  llganStarDust,

  resolveLlganGlassSurface,
  resolveLlganModalHeaderGradient,
  resolveLlganModuleCardGlow,
  resolveLlganViewGlass,
  llganModalHeaderGradient,
} from '@/design/tokens/lightLiquidGlassAuroraNebula';



describe('lightLiquidGlassAuroraNebula tokens', () => {

  it('definiert genau 6 Nebula-Wolken mit Drift 120–220', () => {

    expect(llganNebulaClouds).toHaveLength(6);

    for (const cloud of llganNebulaClouds) {

      expect(cloud.driftX).toBeGreaterThanOrEqual(120);

      expect(cloud.driftX).toBeLessThanOrEqual(220);

      expect(cloud.driftY).toBeGreaterThan(0);

      expect(cloud.speed).toBeGreaterThan(0);

    }

  });



  it('definiert 6 feine Aurora-Wisps ohne breite Bänder', () => {
    expect(llganAuroraWisps).toHaveLength(6);
    for (const wisp of llganAuroraWisps) {
      expect(wisp.length).toBeGreaterThan(0);
      expect(wisp.thickness).toBeLessThanOrEqual(0.05);
    }
  });



  it('definiert genau 24 Star-Dust-Punkte', () => {

    expect(llganStarDust).toHaveLength(24);

    for (const star of llganStarDust) {

      expect(star.nx).toBeGreaterThanOrEqual(0);

      expect(star.nx).toBeLessThanOrEqual(1);

      expect(star.ny).toBeGreaterThanOrEqual(0);

      expect(star.ny).toBeLessThanOrEqual(1);

    }

  });



  it('definiert genau 4 Pearlescent-Glows', () => {

    expect(llganPearlescentGlows).toHaveLength(4);

    for (const glow of llganPearlescentGlows) {

      expect(glow.radius).toBeGreaterThan(0);

      expect(glow.pulseSpeed).toBeGreaterThan(0);

    }

  });



  it('liefert Intensity-Presets subtle, default und strong', () => {

    expect(llganIntensityPresets.subtle.panelAlpha).toBe(0.38);

    expect(llganIntensityPresets.default.panelAlpha).toBe(0.44);

    expect(llganIntensityPresets.strong.cardAlpha).toBe(0.58);

    expect(llganIntensityPresets.default.glassBlur).toBe(30);

    expect(llganIntensityPresets.strong.glassSaturate).toBe(1.5);

  });



  it('spiegelt Milchglas-Werte für Panel, Card, Sidebar, Modal, Blur und Sättigung (default)', () => {

    expect(llganGlassSurface.panel).toBe('rgba(255,255,255,0.44)');

    expect(llganGlassSurface.card).toBe('rgba(255,255,255,0.52)');

    expect(llganGlassSurface.sidebar).toBe('rgba(255,255,255,0.57)');

    expect(llganGlassSurface.modal).toBe('rgba(255,255,255,0.76)');

    expect(llganGlassSurface.blurDesktop).toBe(30);

    expect(llganGlassSurface.saturate).toBe(1.42);

    expect(llganGlassSurface.borderWhite).toBe('rgba(255,255,255,0.58)');

    expect(llganGlassSurface.borderAccent).toBe('rgba(130,170,255,0.18)');

  });



  it('exportiert CSS-Variablen für LLGAN-Intensität', () => {

    const vars = getLlganCssVars('default');

    expect(vars[llganCssVars.panelAlpha]).toBe('0.44');

    expect(vars[llganCssVars.glassBlur]).toBe('30px');

    expect(vars[llganCssVars.centerVeilAlpha]).toBe('0.06');

  });



  it('liefert view-spezifische Glas-Tokens für Dashboard und Mandanten-Center', () => {
    const dashboard = resolveLlganViewGlass('dashboard', 'default');
    const settings = resolveLlganViewGlass('settings', 'default');
    expect(dashboard.card).toBe('rgba(255,255,255,0.52)');
    expect(settings.card).toBe('rgba(255,255,255,0.62)');
    expect(settings.button).toBe('rgba(255,255,255,0.64)');
    expect(settings.borderAccent).toBe('rgba(110,160,255,0.18)');
  });

  it('definiert bunte Light-Modal-Header-Gradient-Stops', () => {
    expect(llganModalHeaderGradient.length).toBeGreaterThanOrEqual(3);
    expect(resolveLlganModalHeaderGradient()).toEqual(llganModalHeaderGradient);
  });
});

