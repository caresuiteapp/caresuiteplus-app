// These PostgreSQL rejections abort the transaction. A missing or unfamiliar
// code cannot establish whether a write committed before its response was lost.
const DEFINITE_ASSIGNMENT_SCHEDULE_REJECTIONS = new Set([
  '23P01', // overlapping employee/client assignment
  '23505', // unique violation
  '23502', // not-null violation
  '23503', // foreign-key violation
  '23514', // check violation
  '22P02', // invalid input representation
  '22004', // required argument missing
  '22007', // invalid datetime format
  '22008', // datetime field overflow
  '42501', // insufficient privilege
  '42703', // undefined column
  '42883', // undefined function
  '42P01', // undefined table
  'P0001', // explicit exception
  'P0002', // profile/client not found
  '40001', // serialization rollback
  '40P01', // deadlock rollback
]);

export function isDefiniteAssignmentScheduleRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return typeof error.code === 'string'
    && DEFINITE_ASSIGNMENT_SCHEDULE_REJECTIONS.has(error.code);
}
