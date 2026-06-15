export type EmployeeFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
};

export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormData, string>>;

export const EMPTY_EMPLOYEE_FORM: EmployeeFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  department: '',
};
