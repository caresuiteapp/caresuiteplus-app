const deletedClientIds = new Set<string>();
const deletedEmployeeIds = new Set<string>();

export function markDemoClientDeleted(clientId: string): void {
  deletedClientIds.add(clientId);
}

export function markDemoEmployeeDeleted(employeeId: string): void {
  deletedEmployeeIds.add(employeeId);
}

export function isDemoClientDeleted(clientId: string): boolean {
  return deletedClientIds.has(clientId);
}

export function isDemoEmployeeDeleted(employeeId: string): boolean {
  return deletedEmployeeIds.has(employeeId);
}

export function resetDemoDeleteStore(): void {
  deletedClientIds.clear();
  deletedEmployeeIds.clear();
}
