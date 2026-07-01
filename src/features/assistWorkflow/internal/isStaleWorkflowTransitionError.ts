/** Errors that usually mean the UI context lagged behind DB — refresh instead of dead-end. */
export function isStaleWorkflowTransitionError(error: string | undefined | null): boolean {
  return error?.trim() === 'Status ist bereits gesetzt.';
}
