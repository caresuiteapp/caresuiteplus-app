import type { EmployeeListItem } from './employeeList';

export type EmployeeDetail = EmployeeListItem & {
  createdAt: string;
  department: string | null;
  startDate: string | null;
  notes: string | null;
  avatarUrl: string | null;
  mobile?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  employmentType?: string | null;
  weeklyHours?: number | null;
  hasFirstAidCertificate?: boolean;
  hasDriverLicense?: boolean;
  driverLicenseClass?: string | null;
  hasPoliceClearance?: boolean;
  policeClearanceDate?: string | null;
};
