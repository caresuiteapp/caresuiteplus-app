import { AssignmentsListScreen } from './AssignmentsListScreen';

/**
 * Compatibility screen for the former German alias.
 * The assignment workflow now has exactly one list implementation.
 */
export function EinsaetzeListScreen() {
  return <AssignmentsListScreen />;
}
