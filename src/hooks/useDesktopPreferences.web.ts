import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDesktopPreferenceStorage, mergeDesktopWidgetPreferences, readDismissedDesktopSuggestionRoutes, readSavedDesktopWidgetIds } from '@/lib/preferences/desktopPreferenceStorage.web';
import { desktopStorageKey, moduleDesktopStorageKey, previousDesktopWidgetIds, restoreDesktopWidgetIds } from '@/liquid-command/navigation/moduleDesktop.web';
import { desktopAreaStorageKey, introduceOfficeDocumentCatalogWidget, introduceOfficeNotesWidget, type DesktopAreaKey } from '@/liquid-command/navigation/desktopAreas';
import { BACKGROUNDS, BACKGROUND_STORAGE_KEY, DEFAULT_DESKTOP_IDS, DESKTOP_SLOT_COUNT, DESKTOP_WIDGETS_STORAGE_KEY, LEGACY_FAVORITES_STORAGE_KEY, PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY, SIDEBAR_STORAGE_KEY, WIDGET_BY_ID } from '@/liquid-command/screens/administrationDesktopCatalog';
import type { ProductKey } from '@/types';

export const desktopPreferenceStorage = createDesktopPreferenceStorage(AsyncStorage);
export type DesktopPreferenceSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Options = {
  tenantId: string;
  owner: string;
  selectedArea: DesktopAreaKey;
  availableWidgetIds: readonly string[];
  defaultWidgetIds: readonly string[];
  migrationWidgetIds: readonly string[];
};
type PreferenceState = {
  scope: string;
  desktopIds: string[];
  savedDesktopIds: string[];
  dismissedSuggestionRoutes: string[];
  sidebarOpen: boolean;
  backgroundId: string;
  recoverableWidgetIds: string[];
};

function migratePreviousDesktop(value: string, migrationRequired: boolean) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Invalid saved desktop widgets');
  const ids = [...new Set(parsed.filter((id): id is string => typeof id === 'string' && WIDGET_BY_ID.has(id)))];
  if (migrationRequired && !ids.includes('logbook') && ids.length > 0) {
    const replaceIndex = ids.indexOf('assist');
    if (replaceIndex >= 0) ids[replaceIndex] = 'logbook';
    else if (ids.length < DESKTOP_SLOT_COUNT) ids.push('logbook');
    else ids[ids.length - 1] = 'logbook';
  }
  return JSON.stringify(ids);
}

function resolveUpdate<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === 'function' ? (action as (current: T) => T)(current) : action;
}

export function useDesktopPreferences({ tenantId, owner, selectedArea, availableWidgetIds, defaultWidgetIds, migrationWidgetIds }: Options) {
  // Include the allowed catalogue so a changed permission set cannot save stale widgets.
  const scope = JSON.stringify([tenantId, owner, selectedArea, availableWidgetIds, defaultWidgetIds, migrationWidgetIds]);
  const [state, setState] = useState<PreferenceState | null>(null);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [saveState, setSaveState] = useState<{ snapshot: PreferenceState; status: DesktopPreferenceSaveStatus } | null>(null);
  const desktopKey = desktopAreaStorageKey(tenantId, owner, selectedArea);
  const catalogIntroductionKey = `${desktopKey}.document-catalog.v1`;
  const notesIntroductionKey = `${desktopKey}.notes.v1`;
  const dismissedSuggestionsKey = `${desktopKey}.dismissed-suggestions.v1`;
  const sidebarKey = `${SIDEBAR_STORAGE_KEY}.${owner}`;
  const backgroundKey = `${BACKGROUND_STORAGE_KEY}.${owner}`;

  useEffect(() => {
    let active = true;
    setLoadFailure(null);
    const [scopeTenant, scopeOwner, area, allowedIds, defaults, migrationIds] = JSON.parse(scope) as [string, string, DesktopAreaKey, string[], string[], string[]];
    if (!scopeTenant || !scopeOwner) return;
    const previousModuleKeys = [desktopStorageKey(scopeTenant, scopeOwner), ...(['office', 'assist', 'pflege', 'stationaer', 'beratung'].includes(area) ? [moduleDesktopStorageKey(scopeTenant, scopeOwner, area as ProductKey)] : [])];
    const keys = [desktopKey, `${DESKTOP_WIDGETS_STORAGE_KEY}.${scopeOwner}`, `${PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY}.${scopeOwner}`, `${LEGACY_FAVORITES_STORAGE_KEY}.${scopeOwner}`, sidebarKey, backgroundKey, catalogIntroductionKey, notesIntroductionKey, dismissedSuggestionsKey, ...previousModuleKeys];
    void desktopPreferenceStorage.read(keys).then(([desktop, oldDesktop, previousDesktop, legacy, sidebar, storedBackground, catalogIntroduction, notesIntroduction, dismissedSuggestions, ...previousModules]) => {
      if (!active) return;
      const oldValue = oldDesktop ?? previousDesktop ?? legacy;
      const previous = desktop !== null || !['office', 'assist'].includes(area) ? [] : previousModules.some(value => value !== null) ? previousModules
        : oldValue !== null ? [migratePreviousDesktop(oldValue, !oldDesktop && Boolean(previousDesktop))] : [];
      // Shared Office apps are opt-in on other areas. Keep the legacy automatic
      // migration area-specific; current placements and explicit recovery use the full catalogue.
      const restoreIds = desktop === null && previous.length > 0 ? migrationIds : allowedIds;
      const restored = restoreDesktopWidgetIds(desktop, previous, restoreIds, defaults);
      const savedDesktopIds = readSavedDesktopWidgetIds(desktop) ?? [];
      // An explicitly empty current or migrated list is a choice, not a missing setup.
      const explicitlyEmpty = restored.length === 0 && (desktop !== null || previous.length > 0);
      const withNotes = area === 'office' && !explicitlyEmpty ? introduceOfficeNotesWidget(restored, allowedIds, notesIntroduction === '1') : restored;
      const desktopIds = area === 'office' && !explicitlyEmpty ? introduceOfficeDocumentCatalogWidget(withNotes, allowedIds, catalogIntroduction === '1') : withNotes;
      setState({
        scope,
        desktopIds,
        savedDesktopIds,
        // Preserve unavailable routes so a restored permission does not undo a dismissal.
        dismissedSuggestionRoutes: readDismissedDesktopSuggestionRoutes(dismissedSuggestions),
        sidebarOpen: sidebar !== 'false',
        backgroundId: storedBackground && BACKGROUNDS.some(item => item.id === storedBackground) ? storedBackground : BACKGROUNDS[0].id,
        recoverableWidgetIds: previousDesktopWidgetIds([...previousModules, oldValue], allowedIds),
      });
    }).catch(() => { if (active) setLoadFailure(scope); });
    return () => { active = false; };
  }, [scope, desktopKey, sidebarKey, backgroundKey, catalogIntroductionKey, notesIntroductionKey, dismissedSuggestionsKey, loadAttempt]);

  const currentState = state?.scope === scope ? state : null;
  const ready = currentState !== null;
  useEffect(() => {
    if (!state || state.scope !== scope) return;
    let active = true;
    const [, , area, allowedIds] = JSON.parse(scope) as [string, string, DesktopAreaKey, string[]];
    const storedIds = mergeDesktopWidgetPreferences(state.desktopIds, state.savedDesktopIds, allowedIds);
    const values: [string, string][] = [[desktopKey, JSON.stringify(storedIds)], [sidebarKey, String(state.sidebarOpen)], [backgroundKey, state.backgroundId], [dismissedSuggestionsKey, JSON.stringify(state.dismissedSuggestionRoutes)]];
    if (area === 'office' && allowedIds.includes('document-catalog')) values.push([catalogIntroductionKey, '1']);
    if (area === 'office' && allowedIds.includes('notes')) values.push([notesIntroductionKey, '1']);
    setSaveState({ snapshot: state, status: 'saving' });
    void desktopPreferenceStorage.write(values).then(() => {
      if (active) setSaveState({ snapshot: state, status: 'saved' });
    }).catch(() => { if (active) setSaveState({ snapshot: state, status: 'error' }); });
    return () => { active = false; };
  }, [state, scope, desktopKey, sidebarKey, backgroundKey, catalogIntroductionKey, notesIntroductionKey, dismissedSuggestionsKey, saveAttempt]);

  const setDesktopIds = useCallback((action: SetStateAction<string[]>) => {
    const [, , , allowedIds] = JSON.parse(scope) as [string, string, DesktopAreaKey, string[]];
    const allowed = new Set(allowedIds);
    setState(current => current?.scope === scope ? { ...current, desktopIds: [...new Set(resolveUpdate(action, current.desktopIds).filter(id => allowed.has(id)))] } : current);
  }, [scope]);
  const setSidebarOpen = useCallback((action: SetStateAction<boolean>) => {
    setState(current => current?.scope === scope ? { ...current, sidebarOpen: resolveUpdate(action, current.sidebarOpen) } : current);
  }, [scope]);
  const dismissSuggestion = useCallback((route: string) => {
    const dismissedRoute = route.trim();
    if (!dismissedRoute.startsWith('/') || dismissedRoute.startsWith('//')) return;
    setState(current => current?.scope === scope && !current.dismissedSuggestionRoutes.includes(dismissedRoute)
      ? { ...current, dismissedSuggestionRoutes: [...current.dismissedSuggestionRoutes, dismissedRoute] }
      : current);
  }, [scope]);
  const setBackgroundId = useCallback((action: SetStateAction<string>) => {
    setState(current => current?.scope === scope ? { ...current, backgroundId: resolveUpdate(action, current.backgroundId) } : current);
  }, [scope]);
  const retry = useCallback(() => {
    if (ready) setSaveAttempt(attempt => attempt + 1);
    else setLoadAttempt(attempt => attempt + 1);
  }, [ready]);

  return {
    ready,
    loadError: loadFailure === scope,
    saveStatus: (ready ? saveState?.snapshot === state ? saveState.status : 'saving' : 'idle') as DesktopPreferenceSaveStatus,
    desktopIds: currentState ? currentState.desktopIds : [...DEFAULT_DESKTOP_IDS],
    dismissedSuggestionRoutes: currentState ? currentState.dismissedSuggestionRoutes : [],
    sidebarOpen: currentState ? currentState.sidebarOpen : true,
    backgroundId: currentState ? currentState.backgroundId : BACKGROUNDS[0].id,
    recoverableWidgetIds: currentState ? currentState.recoverableWidgetIds : [],
    setDesktopIds,
    dismissSuggestion,
    setSidebarOpen,
    setBackgroundId,
    retry,
  };
}
