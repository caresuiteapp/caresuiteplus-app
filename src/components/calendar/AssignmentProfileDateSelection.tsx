import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

export { assignmentProfileClickCount } from './assignmentProfileMultiDay';

export type AssignmentProfileDateSelection = {
  selectedDateKeys: readonly string[];
  disabled: boolean;
  selectDate: (date: Date, clickCount: number, suggestedTime?: string) => void;
};

export const AssignmentProfileDateSelectionContext = createContext<AssignmentProfileDateSelection | null>(null);

export function useAssignmentProfileDateSelection(): AssignmentProfileDateSelection | null {
  const selection = useContext(AssignmentProfileDateSelectionContext);
  return Platform.OS === 'web' ? selection : null;
}
