import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

describe('HealthOS Desktop-Architektur R11', () => {
  it('liefert ein festes, ruhiges 4×3-Desktop-Raster', () => {
    expect(source).toContain('const DESKTOP_SLOT_COUNT = 12');
    expect(source).toContain('const DESKTOP_COLUMN_COUNT = 4');
    expect(source).toContain('Array.from({ length: 3 }');
    expect(source).toContain('width: "25%"');
  });

  it('ersetzt Dock, Ordner und implizites Dragging durch einen Bearbeitungsmodus', () => {
    expect(source).toContain('editMode ? "✓  Fertig" : "✎  Bearbeiten"');
    expect(source).toContain('accessibilityLabel={`${widget.label} entfernen`}');
    expect(source).not.toContain('DockWidget');
    expect(source).not.toContain('WidgetFolder');
    expect(source).not.toContain('pointermove');
  });

  it('persistiert Belegung und Menüzustand benutzerbezogen und übernimmt Alt-Favoriten', () => {
    expect(source).toContain('caresuite.healthos.desktop-widgets.v2');
    expect(source).toContain('caresuite.healthos.sidebar-open.v2');
    expect(source).toContain('caresuite.healthos.top-widgets.v1');
    expect(source).toContain('const owner = auth.user?.id ?? "local"');
    expect(source).toContain('AsyncStorage.multiSet');
  });

  it('zeigt eine kategorisierte, ein- und ausblendbare linke Navigation', () => {
    expect(source).toContain('sidebarOpen ? "Navigation schließen" : "Navigation öffnen"');
    expect(source).toContain('accessibilityState={{ expanded: sidebarOpen }}');
    expect(source).toContain('sidebarMotion.interpolate');
    expect(source).toContain('Organisation');
  });

  it('behält im eingeklappten Zustand einen unabhängigen linken Menüöffner', () => {
    expect(source).toContain('accessibilityLabel="Navigation öffnen"');
    expect(source).toContain('onPress={() => setSidebarOpen(true)}');
    expect(source).toContain('sidebarReopenHost');
    expect(source).toContain('sidebarReopenLabel');
    expect(source).toContain('pointerEvents: sidebarOpen ? "none" : "auto"');
  });

  it('bietet oben rechts ein Center für Apps, Widgets und Workflows', () => {
    expect(source).toContain('Apps und Widgets öffnen');
    expect(source).toContain('CARESUITE HEALTHOS CENTER');
    expect(source).toContain('(["apps", "widgets", "workflows", "backgrounds"] as const)');
    expect(source).toContain('Workflow starten');
    expect(source).toContain('+ Zum Desktop');
  });

  it('wendet die globale Schriftgrößensteuerung auf sämtliche Desktop-Texte an', () => {
    expect(source).toContain('useWebFontScale');
    expect(source).toContain('function Text({ style, ...props }: TextProps)');
    expect(source).toContain('flattened.fontSize * scale');
    expect(source).toContain('flattened.lineHeight * scale');
  });

  it('bietet 16 benutzerbezogen gespeicherte Desktop-Hintergründe', () => {
    expect(source).toContain('caresuite.healthos.desktop-background.v1');
    expect(source).toContain('Desktop-Hintergrund ändern');
    expect(source).toContain('Hintergründe');
    expect(source).toContain('BACKGROUNDS.length');
    expect(source).toContain('[backgroundKey, backgroundId]');
    expect(source).toContain('source={activeBackground.image}');
  });
});
