import type { EmployeeListItem } from './employeeList';

export type EmployeeDetail = EmployeeListItem & {
  createdAt: string;
  department: string | null;
  startDate: string | null;
  notes: string | null;
  avatarUrl: string | null;
};
