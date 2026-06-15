import type { Appointment } from './office';

export type AppointmentListItem = Pick<
  Appointment,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'employeeId'
  | 'title'
  | 'startsAt'
  | 'endsAt'
  | 'status'
  | 'location'
  | 'updatedAt'
> & {
  clientName: string;
  employeeName: string | null;
};
