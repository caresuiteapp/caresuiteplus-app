import React from 'react';
import ClientRecordRoute from '../../app/business/office/clients/[id].native';
import ClientBillingRoute from '../../app/business/office/clients/[id]/billing.native';
import ClientServiceRecordsRoute from '../../app/business/office/clients/[id]/service-records.native';
import ClientTimelineRoute from '../../app/business/office/clients/[id]/timeline.native';
import EmployeeRecordRoute from '../../app/business/office/employees/[id].native';
import EmployeePersonnelRoute from '../../app/business/office/employees/[id]/personnel.native';
import InvoicesRoute from '../../app/business/office/invoices/index.native';
export {administrationPortalAuditRoutes} from './native-administration-audit-data';

// Each case mounts the installed Android route's default component. The runner
// supplies the real Business layout; no hand-built page/shell wraps these views.
export function AdministrationPortalAuditPreview({caseId}){
 const Route={
  'admin-audit-client-record':ClientRecordRoute,
  'admin-audit-client-master-data':ClientRecordRoute,
  'admin-audit-client-billing':ClientBillingRoute,
  'admin-audit-client-billing-restricted':ClientBillingRoute,
  'admin-audit-client-service-records':ClientServiceRecordsRoute,
  'admin-audit-client-timeline':ClientTimelineRoute,
  'admin-audit-employee-record':EmployeeRecordRoute,
  'admin-audit-employee-personnel':EmployeePersonnelRoute,
  'admin-audit-invoices':InvoicesRoute,
 }[caseId];
 if(!Route)throw Error(`Unknown Administration audit route: ${caseId}`);
 return <Route/>;
}
