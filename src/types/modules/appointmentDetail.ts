import type { AppointmentListItem } from '@/types/modules/appointmentList';

export type AppointmentDetail = AppointmentListItem & {
  createdAt: string;
  notes: string | null;
};
