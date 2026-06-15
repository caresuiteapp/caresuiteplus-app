import type { Employee } from '@/types/modules/office';
import type { EmployeeFormData } from '@/types/forms/employeeForm';
import { DEMO_TENANT_ID } from './tenant';
import { demoEmployees } from './employees';

export function createDemoEmployee(form: EmployeeFormData): Employee {
  const id = `employee-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const employee: Employee = {
    id,
    tenantId: DEMO_TENANT_ID,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    jobTitle: form.jobTitle.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    status: 'entwurf',
    createdAt: now,
    updatedAt: now,
  };
  demoEmployees.push({
    id: employee.id,
    tenantId: employee.tenantId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    jobTitle: employee.jobTitle,
    email: employee.email,
    phone: employee.phone,
    status: employee.status,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  });
  return employee;
}
