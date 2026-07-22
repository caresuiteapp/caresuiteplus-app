import type { TenantScopedEntity } from '../core/base';

export type EmployeeSalutation = 'herr' | 'frau' | 'divers';

export type EmployeeCompensationType = 'salary' | 'hourly';

export type EmployeePayoutInterval = 'monthly' | 'weekly' | 'biweekly';

export type EmployeePayoutMethod = 'transfer' | 'cash';

export type EmployeeInsuranceType = 'statutory' | 'private';

export type EmployeeWorkDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type EmployeeWorkDaySchedule = Record<EmployeeWorkDayKey, number>;

export const DEFAULT_WORK_DAY_SCHEDULE: EmployeeWorkDaySchedule = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

export type EmployeePersonalData = {
  salutation: EmployeeSalutation | null;
  academicTitle: string | null;
  nationality: string | null;
  addressSupplement: string | null;
};

export type EmployeeContractSettings = {
  jobTitleKey: string | null;
  educationDegrees: string[];
  workDays: EmployeeWorkDaySchedule;
  workOnHolidays: boolean;
  annualVacationDays: number | null;
  calculatedVacationDays: number | null;
  vacationDaysUsed: number | null;
};

export type EmployeePayrollSettings = {
  compensationType: EmployeeCompensationType;
  compensationAmount: number | null;
  payoutInterval: EmployeePayoutInterval;
  payoutMethod: EmployeePayoutMethod;
  iban: string | null;
  bankName: string | null;
  accountHolder: string | null;
  alternateAccountHolder: string | null;
  maxPayoutHoursMonth: number | null;
  overflowToTimeAccount: boolean;
  mileageRateCents: number;
  payrollNotes: string | null;
};

export type EmployeeTaxSettings = {
  taxCalculationType: string | null;
  taxId: string | null;
};

export type EmployeeSocialInsuranceSettings = {
  insuranceType: EmployeeInsuranceType;
  healthInsuranceKey: string | null;
  pensionFundRegistered: boolean;
  socialSecurityNumber: string | null;
  employerRelationship: boolean;
};

export type EmployeeSecondaryEmploymentRecord = TenantScopedEntity & {
  employeeId: string;
  employerName: string;
  grossMonthlyIncome: number | null;
  sortOrder: number;
};

export type EmployeePayrollPersonnelBundle = {
  personalData: EmployeePersonalData;
  contract: EmployeeContractSettings;
  payroll: EmployeePayrollSettings;
  tax: EmployeeTaxSettings;
  socialInsurance: EmployeeSocialInsuranceSettings;
  secondaryEmployments: EmployeeSecondaryEmploymentRecord[];
};
