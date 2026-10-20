export {
  fetchResidentList,
  fetchStationaerDashboardStats,
  fetchActiveResidents,
} from './residentListService';
export { fetchResidentDetail } from './residentDetailService';
export {
  fetchStationaerCalendarEvents,
  createStationaerCalendarEvent,
  updateStationaerCalendarEvent,
  archiveStationaerCalendarEvent,
  cancelStationaerCalendarEvent,
  syncStationaerCalendarBootstrap,
} from './stationaerCalendarService';
