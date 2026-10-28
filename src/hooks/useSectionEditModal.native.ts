// Generated native presentation from src/hooks/useSectionEditModal.web.ts. Update through scripts/port-native-workspaces.mjs.
import { usePageTab } from "./usePageTab.native.ts";
/** Edit sections restore alongside their record's route and selection. */
export function useSectionEditModal<T extends string>() {
    const [activeSection, setActiveSection] = usePageTab<T | null>('recordEditSection', null);
    const closeSection = useCallback(() => setActiveSection(null), [setActiveSection]);
    return { activeSection, openSection: setActiveSection, closeSection, isOpen: activeSection !== null };
}
import { useCallback } from 'react';
