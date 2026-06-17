export function getEmployeeInitials(firstName: string, lastName: string): string {
  const first = firstName.trim()[0] ?? '';
  const last = lastName.trim()[0] ?? '';
  const combined = `${first}${last}`.toUpperCase();
  return combined || '?';
}
