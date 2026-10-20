import type { Employee } from './office';

export type EmployeeListItem = Pick<
  Employee,
  | 'id'
  | 'tenantId'
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'email'
  | 'phone'
  | 'status'
  | 'updatedAt'
> & {
  avatarUrl?: string | null;
  department?: string | null;
};
