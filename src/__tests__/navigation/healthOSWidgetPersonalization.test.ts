import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);

describe('HealthOS widget personalization', () => {
  it('persists the user-scoped dock order, favorites and folders', () => {
    expect(source).toContain('caresuite.healthos.widget-order.v1');
    expect(source).toContain('caresuite.healthos.top-widgets.v1');
    expect(source).toContain('caresuite.healthos.widget-folders.v1');
    expect(source).toContain('const preferenceOwner = auth.user?.id');
    expect(source).toContain('AsyncStorage.setItem(dockOrderStorageKey');
    expect(source).toContain('AsyncStorage.setItem(favoritesStorageKey');
    expect(source).toContain('AsyncStorage.setItem(foldersStorageKey');
  });

  it('renders ten adaptive wide and square personal Dock slots', () => {
    expect(source).toContain('const FAVORITE_SLOT_COUNT = 10');
    expect(source).toContain('favoriteSlots.slice(rowIndex * 5');
    expect(source).toContain("return widget ? (WIDE_FAVORITE_WIDGETS.has(widget.id) ? 'wide' : 'square')");
    expect(source).toContain('favoriteSlotWide');
    expect(source).toContain('favoriteSlotSquare');
  });

  it('shows ten compact Dock entries per desktop page', () => {
    expect(source).toContain('const pageSize = compact ? 3 : width < 1180 ? 5 : 10');
    expect(source).toContain('maxWidth: 150');
    expect(source).toContain('height: 136');
  });

  it('copies Dock widgets into favorites while keeping the original Dock entry', () => {
    expect(source).toContain("beginPointerDrag({ kind: 'widget', widgetId: entry.widget.id, source: 'dock' }");
    expect(source).toContain('next[targetSlot] = entryId');
    expect(source).toContain("if (target.startsWith('favorite:'))");
  });

  it('uses pointer tracking instead of unreliable native browser drag events', () => {
    expect(source).toContain("window.addEventListener('pointermove', onMove");
    expect(source).toContain("window.addEventListener('pointerup', onUp)");
    expect(source).toContain("closest<HTMLElement>('[data-healthos-drop]')");
    expect(source).toContain('setDragVisual({ payload, x: pointerEvent.clientX, y: pointerEvent.clientY })');
    expect(source).not.toContain('draggable: true');
  });

  it('supports persistent folders with a four-widget preview limit', () => {
    expect(source).toContain('const MAX_FOLDER_WIDGETS = 4');
    expect(source).toContain('function DockFolder');
    expect(source).toContain('moveWidgetIntoFolder');
    expect(source).toContain('dissolveFolder');
    expect(source).toContain('Array.from({ length: MAX_FOLDER_WIDGETS }');
  });

  it('copies Dock folders into the personal Dock without removing the original', () => {
    expect(source).toContain("else copyEntryToFavorite(folderEntryId(payload.folderId)");
    expect(source).toContain("source: 'favorite', slotIndex");
    expect(source).toContain('favoriteFolderPreview');
  });

  it('removes the large personal Dock background while keeping individual glass slots', () => {
    expect(source).toContain("favoritesPanel: { flex: 1, paddingHorizontal: 4");
    expect(source).toContain("backgroundColor: 'transparent'");
    expect(source).toContain("backdropFilter: 'blur(13px) saturate(1.15)'");
  });

  it('provides a settings widget with persistent user-scoped wallpaper selection', () => {
    expect(source).toContain("id: 'settings', label: 'Einstellungen'");
    expect(source).toContain('caresuite.healthos.background.v1');
    expect(source).toContain('const BACKGROUNDS: readonly BackgroundDefinition[]');
    expect(source).toContain('AsyncStorage.setItem(backgroundStorageKey, selectedBackgroundId)');
    expect(source).toContain('activeBackground.image');
  });
});
