export const DESKTOP_SLOT_COUNT = 12;

export type DesktopSlot = string | null;

export function desktopPageCount(slots: readonly DesktopSlot[]) {
  return Math.max(1, Math.ceil(slots.length / DESKTOP_SLOT_COUNT));
}

export function desktopWidgetIds(slots: readonly DesktopSlot[], availableIds: readonly string[]) {
  const available = new Set(availableIds);
  return slots.filter((id): id is string => Boolean(id && available.has(id)));
}

export function readDesktopSlots(value: string | null): DesktopSlot[] | null {
  if (value === null) return null;
  const slots: unknown = JSON.parse(value);
  if (!Array.isArray(slots)) throw new Error('Invalid saved desktop widgets');
  const seen = new Set<string>();
  // Nulls are explicit gaps. Legacy lists only contained app IDs.
  const keepPositions = slots.includes(null);
  return slots.flatMap((id): DesktopSlot[] => {
    if (typeof id !== 'string' || !id || seen.has(id)) return keepPositions ? [null] : [];
    seen.add(id);
    return [id];
  });
}

function withPageCount(slots: DesktopSlot[], pages: number) {
  // A single trailing null on an otherwise empty last page remembers that page.
  const minimum = pages > 1 ? (pages - 1) * DESKTOP_SLOT_COUNT + 1 : 0;
  while (slots.length > minimum && slots.at(-1) === null) slots.pop();
  while (slots.length < minimum) slots.push(null);
  return slots;
}

export function addDesktopPage(slots: readonly DesktopSlot[]) {
  return withPageCount([...slots], desktopPageCount(slots) + 1);
}

export function removeEmptyDesktopPage(slots: readonly DesktopSlot[], page: number) {
  const pages = desktopPageCount(slots);
  const start = page * DESKTOP_SLOT_COUNT;
  if (pages < 2 || page < 0 || page >= pages || slots.slice(start, start + DESKTOP_SLOT_COUNT).some(Boolean)) return slots;
  const next = [...slots];
  next.splice(start, DESKTOP_SLOT_COUNT);
  return withPageCount(next, pages - 1);
}

export function firstFreeDesktopSlot(slots: readonly DesktopSlot[], page: number) {
  let index = page * DESKTOP_SLOT_COUNT;
  while (slots[index]) index++;
  return index;
}

/** Drop onto an occupied position to swap. Adding an app preserves any stored occupant. */
export function placeDesktopWidget(slots: readonly DesktopSlot[], id: string, target: number) {
  if (!Number.isSafeInteger(target) || target < 0 || target >= (desktopPageCount(slots) + 1) * DESKTOP_SLOT_COUNT) return slots;
  const from = slots.indexOf(id);
  if (from === target) return slots;
  const next = [...slots];
  while (next.length <= target) next.push(null);
  const occupant = next[target];
  if (from >= 0) next[from] = occupant;
  else if (occupant) next[firstFreeDesktopSlot(next, Math.floor(target / DESKTOP_SLOT_COUNT))] = occupant;
  next[target] = id;
  return withPageCount(next, Math.max(desktopPageCount(slots), desktopPageCount(next)));
}

export function removeDesktopWidget(slots: readonly DesktopSlot[], id: string) {
  const index = slots.indexOf(id);
  if (index < 0) return slots;
  const next = [...slots];
  next[index] = null;
  return withPageCount(next, desktopPageCount(slots));
}

export function addDesktopWidgets(slots: readonly DesktopSlot[], ids: readonly string[], page = 0) {
  return ids.reduce((layout, id) => layout.includes(id) ? layout
    : placeDesktopWidget(layout, id, firstFreeDesktopSlot(layout, page)), slots);
}

/** Existing dense preferences keep their order. New defaults fill gaps in an arranged desktop. */
export function restoreDesktopSlots(savedSlots: readonly DesktopSlot[] | null, restoredIds: readonly string[]) {
  if (!savedSlots) return restoredIds;
  if (restoredIds.every(id => savedSlots.includes(id))) return savedSlots;
  if (savedSlots.includes(null)) return addDesktopWidgets(savedSlots, restoredIds);
  const firstSaved = restoredIds.findIndex(id => savedSlots.includes(id));
  const prefix = restoredIds.slice(0, Math.max(0, firstSaved));
  return [...prefix, ...savedSlots, ...restoredIds.filter(id => !savedSlots.includes(id) && !prefix.includes(id))];
}

export function moveDesktopWidgetInOrder(slots: readonly DesktopSlot[], ids: readonly string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id);
  const neighbor = index >= 0 ? ids[index + direction] : undefined;
  return neighbor ? placeDesktopWidget(slots, id, slots.indexOf(neighbor)) : slots;
}

export function desktopPageSlots(slots: readonly DesktopSlot[], page: number) {
  return Array.from({ length: DESKTOP_SLOT_COUNT }, (_, index) => slots[page * DESKTOP_SLOT_COUNT + index] ?? null);
}
