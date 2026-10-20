export type EmployeeEditSectionKey = 'stammdaten' | 'anstellung' | 'qualifikationen';

export const EMPLOYEE_SECTION_EDIT_TITLES: Record<EmployeeEditSectionKey, string> = {
  stammdaten: 'Stammdaten bearbeiten',
  anstellung: 'Anstellung & Adresse bearbeiten',
  qualifikationen: 'Qualifikationen bearbeiten',
};

export const EMPLOYEE_EDIT_SECTION_INDEX: Record<EmployeeEditSectionKey, number> = {
  stammdaten: 0,
  anstellung: 1,
  qualifikationen: 2,
};

export function employeeSectionEditTitle(section: EmployeeEditSectionKey): string {
  return EMPLOYEE_SECTION_EDIT_TITLES[section];
}
