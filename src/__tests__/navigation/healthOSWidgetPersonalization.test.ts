import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

describe('HealthOS widget personalization', () => {
  it('persists the user-scoped dock order and Top-10 slots', () => {
    expect(source).toContain('caresuite.healthos.widget-order.v1');
    expect(source).toContain('caresuite.healthos.top-widgets.v1');
    expect(source).toContain('const preferenceOwner = auth.user?.id');
    expect(source).toContain('AsyncStorage.setItem(dockOrderStorageKey');
    expect(source).toContain('AsyncStorage.setItem(favoritesStorageKey');
  });

  it('renders a fixed two-by-five favorites raster', () => {
    expect(source).toContain('const FAVORITE_SLOT_COUNT = 10');
    expect(source).toContain('favoriteSlots.map');
    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).toContain("width: '19%'");
    expect(source).toContain("height: '46%'");
  });

  it('copies Dock widgets into favorites while keeping Dock order independent', () => {
    expect(source).toContain("beginDrag({ widgetId: widget.id, source: 'dock' }");
    expect(source).toContain('next[targetSlot] = payload.widgetId');
    expect(source).toContain("if (payload?.source === 'dock'");
    expect(source).toContain('setWidgetOrder((current) =>');
  });

  it('supports drag reordering and swapping through native browser drag events', () => {
    expect(source).toContain('draggable: true');
    expect(source).toContain("setData?.('application/x-caresuite-widget'");
    expect(source).toContain('onDrop={(event) => dropOnDockWidget');
    expect(source).toContain('onDrop={(event) => dropOnFavoriteSlot');
  });
});
