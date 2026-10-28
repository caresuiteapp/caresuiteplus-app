import {createAcademyReportCsv} from './academyReportsExport.ts';
import type {AcademyReport} from './academyReports';
import {shareNativeFile} from '@/lib/platform/nativeFileDelivery.native';
export {createAcademyReportCsv};
export async function downloadAcademyReportCsv(report:AcademyReport):Promise<void>{await shareNativeFile(createAcademyReportCsv(report),'akademie-auswertung-'+report.today+'.csv','text/csv');}
