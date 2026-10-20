import type { WorkflowStatus } from '@/types';
import type { StationaerCalendarSourceType } from '@/types/calendar';

export type StationaerCalendarEntity = {
  id: string;
  tenantId: string;
  sourceType: StationaerCalendarSourceType;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: WorkflowStatus;
  relatedResidentId: string | null;
  relatedWardId: string | null;
  relatedEmployeeId: string | null;
  room: string | null;
  locationType: string | null;
  locationName: string | null;
  isClientPortalVisible: boolean;
  isEmployeePortalVisible: boolean;
  isRelativePortalVisible: boolean;
  updatedAt: string;
};

export type StationaerCalendarCreateInput = {
  sourceType: StationaerCalendarSourceType;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  status?: WorkflowStatus;
  relatedResidentId?: string | null;
  relatedWardId?: string | null;
  relatedEmployeeId?: string | null;
  room?: string | null;
  locationType?: string | null;
  locationName?: string | null;
  isClientPortalVisible?: boolean;
  isEmployeePortalVisible?: boolean;
  isRelativePortalVisible?: boolean;
};

export type StationaerCalendarUpdateInput = Partial<
  Omit<StationaerCalendarCreateInput, 'sourceType'>
>;
