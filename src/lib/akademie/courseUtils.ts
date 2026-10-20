export function isCourseUpcoming(startsAt: string | null): boolean {
  if (!startsAt) return false;
  return new Date(startsAt) > new Date();
}
