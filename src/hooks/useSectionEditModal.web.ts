import { usePageTab } from './usePageTab.web';

/** Edit sections restore alongside their record's route and selection. */
export function useSectionEditModal<T extends string>() {
  const [activeSection, setActiveSection] = usePageTab<T | null>('recordEditSection', null);
  const closeSection = useCallback(() => setActiveSection(null), [setActiveSection]);
  return { activeSection, openSection: setActiveSection, closeSection, isOpen: activeSection !== null };
}
import { useCallback } from 'react';
