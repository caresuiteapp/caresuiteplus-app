const NON_PAYROLL_EMPLOYEE_STATUSES = new Set([
  'archiviert',
  'ausgeschieden',
  'deleted',
  'gesperrt',
]);

/**
 * Employee status is TEXT in current installations, but some upgraded tenants
 * still use an older employee_status enum. Filtering after the tenant query
 * keeps payroll compatible with both schema generations.
 */
export function isPayrollRelevantEmployee(row: { status?: unknown }): boolean {
  const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
  return !NON_PAYROLL_EMPLOYEE_STATUSES.has(status);
}
