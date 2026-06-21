import { useCallback, useState } from 'react';

/** Opens/closes a single record section edit modal (no multi-step wizard). */
export function useSectionEditModal<T extends string>() {
  const [activeSection, setActiveSection] = useState<T | null>(null);

  const openSection = useCallback((section: T) => {
    setActiveSection(section);
  }, []);

  const closeSection = useCallback(() => {
    setActiveSection(null);
  }, []);

  return {
    activeSection,
    openSection,
    closeSection,
    isOpen: activeSection !== null,
  };
}
