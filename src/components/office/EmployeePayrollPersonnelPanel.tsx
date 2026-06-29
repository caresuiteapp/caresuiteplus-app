import { Platform, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { CareAddressSearch, CareDateInput } from '@/components/inputs';
import { DetailInfoRow } from '@/components/detail';
import { FilterChipGroup, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  COMPENSATION_TYPE_OPTIONS,
  EMPLOYEE_SALUTATION_OPTIONS,
  fetchEmployeePayrollCatalogOptions,
  INSURANCE_TYPE_OPTIONS,
  PAYOUT_INTERVAL_OPTIONS,
  PAYOUT_METHOD_OPTIONS,
  resolvePayrollCatalogLabel,
  WORK_DAY_LABELS,
} from '@/lib/office/employeePayrollCatalogService';
import {
  replaceEmployeeSecondaryEmployments,
  updateEmployeeContractSettings,
  updateEmployeePayrollSettings,
  updateEmployeePersonalPayrollData,
  updateEmployeeSocialInsuranceSettings,
  updateEmployeeTaxSettings,
} from '@/lib/office/employeePayrollPersonnelUpdateService';
import { updateEmployeeMasterData } from '@/lib/office/employeePersonnelUpdateService';
import type { EmployeePayrollPersonnelBundle } from '@/types/modules/employeePayrollPersonnel';
import type { EmployeeMasterData } from '@/types/modules/employeePersonnelFile';
import type { RoleKey } from '@/types/core/auth';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { formatDate, parseGermanDate } from '@/lib/formatters/dateTimeFormatters';
import { spacing } from '@/theme';

function toIsoDateOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseGermanDate(trimmed) ?? (/^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null);
}

async function flushFocusedInputs(): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await Promise.resolve();
  }
}

type PayrollTabKey = 'master_data' | 'employment' | 'compensation' | 'tax_social' | 'secondary_employment';

type Props = {
  tab: PayrollTabKey;
  tenantId: string;
  employeeId: string;
  masterData: EmployeeMasterData;
  payroll: EmployeePayrollPersonnelBundle;
  canEdit: boolean;
  saving: boolean;
  actorRoleKey?: RoleKey | null;
  actorProfileId?: string | null;
  panelCtx?: { viewContext?: 'form' };
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  setSaving: (value: boolean) => void;
};

export function EmployeePayrollPersonnelPanel({
  tab,
  tenantId,
  employeeId,
  masterData,
  payroll,
  canEdit,
  saving,
  actorRoleKey,
  actorProfileId,
  panelCtx = {},
  onSaved,
  onError,
  onSuccess,
  setSaving,
}: Props) {
  const content = useAdaptiveContentStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        formBlock: { marginTop: spacing.sm, gap: spacing.sm },
        fieldLabel: { ...content.caption, marginBottom: spacing.xs },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        toggleLabel: { ...content.body, flex: 1 },
        rowActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
      }),
    [content],
  );

  const jobTitleQuery = useAsyncQuery(
    () => fetchEmployeePayrollCatalogOptions('employee_job_title'),
    [tenantId],
  );
  const taxTypeQuery = useAsyncQuery(
    () => fetchEmployeePayrollCatalogOptions('employee_tax_calculation'),
    [tenantId],
  );
  const healthInsuranceQuery = useAsyncQuery(
    () => fetchEmployeePayrollCatalogOptions('employee_health_insurance'),
    [tenantId],
  );

  const [salutation, setSalutation] = useState('');
  const [academicTitle, setAcademicTitle] = useState('');
  const [nationality, setNationality] = useState('DE');
  const [addressSupplement, setAddressSupplement] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [jobTitleKey, setJobTitleKey] = useState('');
  const [educationDegree, setEducationDegree] = useState('');
  const [educationDegrees, setEducationDegrees] = useState<string[]>([]);
  const [workDayHours, setWorkDayHours] = useState<Record<string, string>>({});
  const [workOnHolidays, setWorkOnHolidays] = useState(false);
  const [annualVacationDays, setAnnualVacationDays] = useState('');
  const [exitDate, setExitDate] = useState('');

  const [compensationType, setCompensationType] = useState('salary');
  const [compensationAmount, setCompensationAmount] = useState('');
  const [payoutInterval, setPayoutInterval] = useState('monthly');
  const [payoutMethod, setPayoutMethod] = useState('transfer');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [alternateAccountHolder, setAlternateAccountHolder] = useState('');

  const [taxCalculationType, setTaxCalculationType] = useState('');
  const [taxId, setTaxId] = useState('');
  const [insuranceType, setInsuranceType] = useState('statutory');
  const [healthInsuranceKey, setHealthInsuranceKey] = useState('');
  const [pensionFundRegistered, setPensionFundRegistered] = useState(false);
  const [socialSecurityNumber, setSocialSecurityNumber] = useState('');
  const [employerRelationship, setEmployerRelationship] = useState(false);

  const [secondaryRows, setSecondaryRows] = useState<Array<{ employerName: string; grossMonthlyIncome: string }>>([]);

  useEffect(() => {
    const p = payroll.personalData;
    setSalutation(p.salutation ?? '');
    setAcademicTitle(p.academicTitle ?? '');
    setNationality(p.nationality ?? 'DE');
    setAddressSupplement(p.addressSupplement ?? '');

    setStreet(masterData.street ?? '');
    setHouseNumber(masterData.houseNumber ?? '');
    setPostalCode(masterData.postalCode ?? '');
    setCity(masterData.city ?? '');
    setCountry(masterData.country ?? 'DE');
    setDateOfBirth(masterData.dateOfBirth ?? '');

    const c = payroll.contract;
    setJobTitleKey(c.jobTitleKey ?? '');
    setEducationDegrees(c.educationDegrees);
    setWorkOnHolidays(c.workOnHolidays);
    setAnnualVacationDays(c.annualVacationDays != null ? String(c.annualVacationDays) : '');
    setWorkDayHours(
      Object.fromEntries(
        Object.entries(c.workDays).map(([key, value]) => [key, value > 0 ? String(value) : '']),
      ),
    );

    setExitDate(masterData.exitDate ?? '');

    const pay = payroll.payroll;
    setCompensationType(pay.compensationType);
    setCompensationAmount(pay.compensationAmount != null ? String(pay.compensationAmount) : '');
    setPayoutInterval(pay.payoutInterval);
    setPayoutMethod(pay.payoutMethod);
    setIban(pay.iban ?? '');
    setBankName(pay.bankName ?? '');
    setAccountHolder(pay.accountHolder ?? '');
    setAlternateAccountHolder(pay.alternateAccountHolder ?? '');

    const t = payroll.tax;
    setTaxCalculationType(t.taxCalculationType ?? '');
    setTaxId(t.taxId ?? '');

    const s = payroll.socialInsurance;
    setInsuranceType(s.insuranceType);
    setHealthInsuranceKey(s.healthInsuranceKey ?? '');
    setPensionFundRegistered(s.pensionFundRegistered);
    setSocialSecurityNumber(s.socialSecurityNumber ?? '');
    setEmployerRelationship(s.employerRelationship);

    setSecondaryRows(
      payroll.secondaryEmployments.map((row) => ({
        employerName: row.employerName,
        grossMonthlyIncome: row.grossMonthlyIncome != null ? String(row.grossMonthlyIncome) : '',
      })),
    );
  }, [
    payroll,
    masterData.exitDate,
    masterData.street,
    masterData.houseNumber,
    masterData.postalCode,
    masterData.city,
    masterData.country,
    masterData.dateOfBirth,
  ]);

  async function runSave(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setSaving(true);
    const result = await action();
    setSaving(false);
    if (!result.ok) {
      onError(result.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    onSuccess(success);
    await onSaved();
  }

  function parseAmount(raw: string): number | null {
    const trimmed = raw.trim().replace(',', '.');
    if (!trimmed) return null;
    const num = Number.parseFloat(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  if (tab === 'master_data') {
    return (
      <SectionPanel {...panelCtx} title="Persönliche Daten">
        {canEdit ? (
          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>Anrede</Text>
            <FilterChipGroup
              options={EMPLOYEE_SALUTATION_OPTIONS}
              value={salutation || EMPLOYEE_SALUTATION_OPTIONS[0]?.key || ''}
              onChange={setSalutation}
            />
            <PremiumInput label="Akademischer Titel" value={academicTitle} onChangeText={setAcademicTitle} />
            <PremiumInput label="Staatsangehörigkeit (ISO)" value={nationality} onChangeText={setNationality} />
            <PremiumInput label="Adresszusatz" value={addressSupplement} onChangeText={setAddressSupplement} />
            <CareAddressSearch
              values={{
                street,
                houseNumber,
                zip: postalCode,
                city,
              }}
              onChange={(address) => {
                setStreet(address.street);
                setHouseNumber(address.houseNumber);
                setPostalCode(address.zip);
                setCity(address.city);
              }}
            />
            <PremiumInput label="Land (ISO)" value={country} onChangeText={setCountry} />
            <CareDateInput label="Geburtsdatum" value={dateOfBirth} onChange={setDateOfBirth} />
            <PremiumButton
              title="Persönliche Daten speichern"
              loading={saving}
              onPress={async () => {
                await flushFocusedInputs();
                void runSave(
                  async () => {
                    const payrollResult = await updateEmployeePersonalPayrollData(
                      tenantId,
                      employeeId,
                      {
                        salutation: (salutation || null) as EmployeePayrollPersonnelBundle['personalData']['salutation'],
                        academicTitle: academicTitle.trim() || null,
                        nationality: nationality.trim() || 'DE',
                        addressSupplement: addressSupplement.trim() || null,
                      },
                      actorRoleKey,
                      actorProfileId,
                    );
                    if (!payrollResult.ok) {
                      return { ok: false, error: payrollResult.error };
                    }
                    const masterResult = await updateEmployeeMasterData(
                      tenantId,
                      employeeId,
                      {
                        street: street.trim() || null,
                        houseNumber: houseNumber.trim() || null,
                        postalCode: postalCode.trim() || null,
                        city: city.trim() || null,
                        country: country.trim() || 'DE',
                        dateOfBirth: toIsoDateOrNull(dateOfBirth),
                      },
                      actorRoleKey,
                      actorProfileId,
                    );
                    return { ok: masterResult.ok, error: masterResult.ok ? undefined : masterResult.error };
                  },
                  'Persönliche Daten gespeichert.',
                );
              }}
            />
          </View>
        ) : (
          <>
            <DetailInfoRow
              label="Anrede"
              value={
                EMPLOYEE_SALUTATION_OPTIONS.find((o) => o.key === payroll.personalData.salutation)?.label ?? '—'
              }
            />
            <DetailInfoRow label="Akademischer Titel" value={payroll.personalData.academicTitle ?? '—'} />
            <DetailInfoRow label="Staatsangehörigkeit" value={payroll.personalData.nationality ?? 'DE'} />
            <DetailInfoRow label="Adresszusatz" value={payroll.personalData.addressSupplement ?? '—'} />
            <DetailInfoRow
              label="Straße"
              value={[masterData.street, masterData.houseNumber].filter(Boolean).join(' ') || '—'}
            />
            <DetailInfoRow
              label="Ort"
              value={[masterData.postalCode, masterData.city].filter(Boolean).join(' ') || '—'}
            />
            <DetailInfoRow label="Land" value={masterData.country ?? 'DE'} />
            <DetailInfoRow
              label="Geburtsdatum"
              value={masterData.dateOfBirth ? formatDate(masterData.dateOfBirth) : '—'}
            />
          </>
        )}
      </SectionPanel>
    );
  }

  if (tab === 'employment') {
    const jobOptions = (jobTitleQuery.data ?? []).map((o) => ({ key: o.key, label: o.label }));
    return (
      <>
        <SectionPanel {...panelCtx} title="Vertragsdaten">
          {canEdit ? (
            <View style={styles.formBlock}>
              <Text style={styles.fieldLabel}>Tätigkeit</Text>
              <FilterChipGroup
                options={jobOptions.length > 0 ? jobOptions : [{ key: 'pflegefachkraft', label: 'Pflegefachkraft' }]}
                value={jobTitleKey || jobOptions[0]?.key || ''}
                onChange={setJobTitleKey}
              />
              <PremiumInput
                label="Bildungsabschluss hinzufügen"
                value={educationDegree}
                onChangeText={setEducationDegree}
              />
              <PremiumButton
                title="Abschluss übernehmen"
                size="sm"
                variant="secondary"
                onPress={() => {
                  const trimmed = educationDegree.trim();
                  if (!trimmed) return;
                  setEducationDegrees((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                  setEducationDegree('');
                }}
              />
              {educationDegrees.length > 0 ? (
                <DetailInfoRow label="Abschlüsse" value={educationDegrees.join(', ')} />
              ) : null}
              <Text style={styles.fieldLabel}>Stunden pro Wochentag</Text>
              {Object.entries(WORK_DAY_LABELS).map(([key, label]) => (
                <PremiumInput
                  key={key}
                  label={label}
                  value={workDayHours[key] ?? ''}
                  onChangeText={(value) => setWorkDayHours((prev) => ({ ...prev, [key]: value }))}
                  keyboardType="decimal-pad"
                />
              ))}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Arbeit an Feiertagen</Text>
                <PremiumButton
                  title={workOnHolidays ? 'Ja' : 'Nein'}
                  size="sm"
                  variant={workOnHolidays ? 'primary' : 'secondary'}
                  onPress={() => setWorkOnHolidays((v) => !v)}
                />
              </View>
              <CareDateInput label="Eintrittsdatum" value={masterData.entryDate ?? ''} onChange={() => undefined} />
              <CareDateInput label="Austrittsdatum" value={exitDate} onChange={setExitDate} />
              <PremiumButton
                title="Vertragsdaten speichern"
                loading={saving}
                onPress={() => {
                  const workDays = Object.fromEntries(
                    Object.keys(WORK_DAY_LABELS).map((key) => [
                      key,
                      parseAmount(workDayHours[key] ?? '') ?? 0,
                    ]),
                  ) as EmployeePayrollPersonnelBundle['contract']['workDays'];
                  void runSave(
                    () =>
                      updateEmployeeContractSettings(
                        tenantId,
                        employeeId,
                        {
                          jobTitleKey: jobTitleKey || null,
                          educationDegrees,
                          workDays,
                          workOnHolidays,
                        },
                        actorRoleKey,
                        actorProfileId,
                      ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                    'Vertragsdaten gespeichert.',
                  );
                }}
              />
            </View>
          ) : (
            <>
              <DetailInfoRow
                label="Tätigkeit"
                value={resolvePayrollCatalogLabel('employee_job_title', payroll.contract.jobTitleKey)}
              />
              <DetailInfoRow
                label="Bildungsabschlüsse"
                value={payroll.contract.educationDegrees.join(', ') || '—'}
              />
              {Object.entries(WORK_DAY_LABELS).map(([key, label]) => (
                <DetailInfoRow
                  key={key}
                  label={label}
                  value={payroll.contract.workDays[key as keyof typeof payroll.contract.workDays] > 0
                    ? `${payroll.contract.workDays[key as keyof typeof payroll.contract.workDays]} Std.`
                    : '—'}
                />
              ))}
              <DetailInfoRow label="Arbeit an Feiertagen" value={payroll.contract.workOnHolidays ? 'Ja' : 'Nein'} />
              <DetailInfoRow label="Eintrittsdatum" value={masterData.entryDate ?? '—'} />
              <DetailInfoRow label="Austrittsdatum" value={masterData.exitDate ?? '—'} />
            </>
          )}
        </SectionPanel>
        <SectionPanel title="Urlaubsanspruch">
          {canEdit ? (
            <View style={styles.formBlock}>
              <PremiumInput
                label="Vertraglicher Jahresurlaub (Tage)"
                value={annualVacationDays}
                onChangeText={setAnnualVacationDays}
                keyboardType="decimal-pad"
              />
              <PremiumButton
                title="Urlaubsdaten speichern"
                loading={saving}
                onPress={() =>
                  void runSave(
                    () =>
                      updateEmployeeContractSettings(
                        tenantId,
                        employeeId,
                        { annualVacationDays: parseAmount(annualVacationDays) },
                        actorRoleKey,
                        actorProfileId,
                      ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                    'Urlaubsdaten gespeichert.',
                  )
                }
              />
            </View>
          ) : null}
          <DetailInfoRow
            label="Vertraglicher Jahresurlaub"
            value={payroll.contract.annualVacationDays != null ? `${payroll.contract.annualVacationDays} Tage` : '—'}
          />
          <DetailInfoRow
            label="Berechneter Anspruch (laufendes Jahr)"
            value={
              payroll.contract.calculatedVacationDays != null
                ? `${payroll.contract.calculatedVacationDays} Tage`
                : '—'
            }
          />
          <DetailInfoRow
            label="Genommener Urlaub (WFM)"
            value={
              payroll.contract.vacationDaysUsed != null ? `${payroll.contract.vacationDaysUsed} Tage` : '0 Tage'
            }
          />
        </SectionPanel>
      </>
    );
  }

  if (tab === 'compensation') {
    return (
      <SectionPanel {...panelCtx} title="Vergütung & Bank">
        {canEdit ? (
          <View style={styles.formBlock}>
            <Text style={styles.fieldLabel}>Vergütungsart</Text>
            <FilterChipGroup
              options={COMPENSATION_TYPE_OPTIONS}
              value={compensationType}
              onChange={setCompensationType}
            />
            <PremiumInput
              label={compensationType === 'hourly' ? 'Stundenlohn (EUR)' : 'Gehalt (EUR)'}
              value={compensationAmount}
              onChangeText={setCompensationAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>Auszahlungsintervall</Text>
            <FilterChipGroup options={PAYOUT_INTERVAL_OPTIONS} value={payoutInterval} onChange={setPayoutInterval} />
            <Text style={styles.fieldLabel}>Lohnzahlung</Text>
            <FilterChipGroup options={PAYOUT_METHOD_OPTIONS} value={payoutMethod} onChange={setPayoutMethod} />
            <PremiumInput label="IBAN" value={iban} onChangeText={setIban} autoCapitalize="characters" />
            <PremiumInput label="Kreditinstitut" value={bankName} onChangeText={setBankName} />
            <PremiumInput label="Kontoinhaber" value={accountHolder} onChangeText={setAccountHolder} />
            <PremiumInput
              label="Abweichender Kontoinhaber"
              value={alternateAccountHolder}
              onChangeText={setAlternateAccountHolder}
            />
            <PremiumButton
              title="Vergütung speichern"
              loading={saving}
              onPress={() =>
                void runSave(
                  () =>
                    updateEmployeePayrollSettings(
                      tenantId,
                      employeeId,
                      {
                        compensationType: compensationType as 'salary' | 'hourly',
                        compensationAmount: parseAmount(compensationAmount),
                        payoutInterval: payoutInterval as 'monthly' | 'weekly' | 'biweekly',
                        payoutMethod: payoutMethod as 'transfer' | 'cash',
                        iban: iban.trim() || null,
                        bankName: bankName.trim() || null,
                        accountHolder: accountHolder.trim() || null,
                        alternateAccountHolder: alternateAccountHolder.trim() || null,
                      },
                      actorRoleKey,
                      actorProfileId,
                    ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                  'Vergütungsdaten gespeichert.',
                )
              }
            />
          </View>
        ) : (
          <>
            <DetailInfoRow
              label="Vergütungsart"
              value={COMPENSATION_TYPE_OPTIONS.find((o) => o.key === payroll.payroll.compensationType)?.label ?? '—'}
            />
            <DetailInfoRow
              label="Betrag"
              value={
                payroll.payroll.compensationAmount != null
                  ? `${payroll.payroll.compensationAmount.toLocaleString('de-DE')} EUR`
                  : '—'
              }
            />
            <DetailInfoRow
              label="Auszahlungsintervall"
              value={PAYOUT_INTERVAL_OPTIONS.find((o) => o.key === payroll.payroll.payoutInterval)?.label ?? '—'}
            />
            <DetailInfoRow
              label="Lohnzahlung"
              value={PAYOUT_METHOD_OPTIONS.find((o) => o.key === payroll.payroll.payoutMethod)?.label ?? '—'}
            />
            <DetailInfoRow label="IBAN" value={payroll.payroll.iban ?? '—'} />
            <DetailInfoRow label="Kreditinstitut" value={payroll.payroll.bankName ?? '—'} />
            <DetailInfoRow label="Kontoinhaber" value={payroll.payroll.accountHolder ?? '—'} />
            <DetailInfoRow
              label="Abweichender Kontoinhaber"
              value={payroll.payroll.alternateAccountHolder ?? '—'}
            />
          </>
        )}
      </SectionPanel>
    );
  }

  if (tab === 'tax_social') {
    const taxOptions = (taxTypeQuery.data ?? []).map((o) => ({ key: o.key, label: o.label }));
    const kkOptions = (healthInsuranceQuery.data ?? []).map((o) => ({ key: o.key, label: o.label }));
    return (
      <>
        <SectionPanel {...panelCtx} title="Lohnsteuer">
          {canEdit ? (
            <View style={styles.formBlock}>
              <Text style={styles.fieldLabel}>Art der Lohnsteuerermittlung</Text>
              <FilterChipGroup
                options={taxOptions.length > 0 ? taxOptions : [{ key: 'lohnsteuer_tabelle', label: 'Lohnsteuer-Tabelle' }]}
                value={taxCalculationType || taxOptions[0]?.key || ''}
                onChange={setTaxCalculationType}
              />
              <PremiumInput label="Steuer-Identifikationsnummer" value={taxId} onChangeText={setTaxId} />
              <PremiumButton
                title="Lohnsteuer speichern"
                loading={saving}
                onPress={() =>
                  void runSave(
                    () =>
                      updateEmployeeTaxSettings(
                        tenantId,
                        employeeId,
                        {
                          taxCalculationType: taxCalculationType || null,
                          taxId: taxId.trim() || null,
                        },
                        actorRoleKey,
                        actorProfileId,
                      ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                    'Lohnsteuerdaten gespeichert.',
                  )
                }
              />
            </View>
          ) : (
            <>
              <DetailInfoRow
                label="Lohnsteuerermittlung"
                value={resolvePayrollCatalogLabel('employee_tax_calculation', payroll.tax.taxCalculationType)}
              />
              <DetailInfoRow label="Steuer-ID" value={payroll.tax.taxId ?? '—'} />
            </>
          )}
        </SectionPanel>
        <SectionPanel title="Sozialversicherung">
          {canEdit ? (
            <View style={styles.formBlock}>
              <Text style={styles.fieldLabel}>Art der Versicherung</Text>
              <FilterChipGroup options={INSURANCE_TYPE_OPTIONS} value={insuranceType} onChange={setInsuranceType} />
              <Text style={styles.fieldLabel}>Krankenkasse</Text>
              <FilterChipGroup
                options={kkOptions.length > 0 ? kkOptions : [{ key: 'tk', label: 'Techniker Krankenkasse' }]}
                value={healthInsuranceKey || kkOptions[0]?.key || ''}
                onChange={setHealthInsuranceKey}
              />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Versorgungswerk angemeldet</Text>
                <PremiumButton
                  title={pensionFundRegistered ? 'Ja' : 'Nein'}
                  size="sm"
                  variant={pensionFundRegistered ? 'primary' : 'secondary'}
                  onPress={() => setPensionFundRegistered((v) => !v)}
                />
              </View>
              <PremiumInput label="Versicherungsnummer" value={socialSecurityNumber} onChangeText={setSocialSecurityNumber} />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Verwandtschaft zum Arbeitgeber</Text>
                <PremiumButton
                  title={employerRelationship ? 'Ja' : 'Nein'}
                  size="sm"
                  variant={employerRelationship ? 'primary' : 'secondary'}
                  onPress={() => setEmployerRelationship((v) => !v)}
                />
              </View>
              <PremiumButton
                title="Sozialversicherung speichern"
                loading={saving}
                onPress={() =>
                  void runSave(
                    () =>
                      updateEmployeeSocialInsuranceSettings(
                        tenantId,
                        employeeId,
                        {
                          insuranceType: insuranceType as 'statutory' | 'private',
                          healthInsuranceKey: healthInsuranceKey || null,
                          pensionFundRegistered,
                          socialSecurityNumber: socialSecurityNumber.trim() || null,
                          employerRelationship,
                        },
                        actorRoleKey,
                        actorProfileId,
                      ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                    'Sozialversicherungsdaten gespeichert.',
                  )
                }
              />
            </View>
          ) : (
            <>
              <DetailInfoRow
                label="Versicherungsart"
                value={INSURANCE_TYPE_OPTIONS.find((o) => o.key === payroll.socialInsurance.insuranceType)?.label ?? '—'}
              />
              <DetailInfoRow
                label="Krankenkasse"
                value={resolvePayrollCatalogLabel(
                  'employee_health_insurance',
                  payroll.socialInsurance.healthInsuranceKey,
                )}
              />
              <DetailInfoRow
                label="Versorgungswerk angemeldet"
                value={payroll.socialInsurance.pensionFundRegistered ? 'Ja' : 'Nein'}
              />
              <DetailInfoRow label="Versicherungsnummer" value={payroll.socialInsurance.socialSecurityNumber ?? '—'} />
              <DetailInfoRow
                label="Verwandtschaft zum Arbeitgeber"
                value={payroll.socialInsurance.employerRelationship ? 'Ja' : 'Nein'}
              />
            </>
          )}
        </SectionPanel>
      </>
    );
  }

  return (
    <SectionPanel {...panelCtx} title="Mehrfachbeschäftigung">
      {secondaryRows.map((row, index) => (
        <View key={`sec-${index}`} style={styles.formBlock}>
          {canEdit ? (
            <>
              <PremiumInput
                label="Arbeitgeber"
                value={row.employerName}
                onChangeText={(value) =>
                  setSecondaryRows((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, employerName: value } : item)),
                  )
                }
              />
              <PremiumInput
                label="Monatsentgelt brutto (EUR)"
                value={row.grossMonthlyIncome}
                onChangeText={(value) =>
                  setSecondaryRows((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, grossMonthlyIncome: value } : item)),
                  )
                }
                keyboardType="decimal-pad"
              />
              <PremiumButton
                title="Zeile entfernen"
                size="sm"
                variant="secondary"
                onPress={() => setSecondaryRows((prev) => prev.filter((_, i) => i !== index))}
              />
            </>
          ) : (
            <>
              <DetailInfoRow label="Arbeitgeber" value={row.employerName || '—'} />
              <DetailInfoRow
                label="Monatsentgelt brutto"
                value={row.grossMonthlyIncome ? `${row.grossMonthlyIncome} EUR` : '—'}
              />
            </>
          )}
        </View>
      ))}
      {canEdit ? (
        <View style={styles.rowActions}>
          <PremiumButton
            title="Weitere Beschäftigung"
            variant="secondary"
            onPress={() => setSecondaryRows((prev) => [...prev, { employerName: '', grossMonthlyIncome: '' }])}
          />
          <PremiumButton
            title="Mehrfachbeschäftigung speichern"
            loading={saving}
            onPress={() =>
              void runSave(
                () =>
                  replaceEmployeeSecondaryEmployments(
                    tenantId,
                    employeeId,
                    secondaryRows.map((row) => ({
                      employerName: row.employerName,
                      grossMonthlyIncome: parseAmount(row.grossMonthlyIncome),
                    })),
                    actorRoleKey,
                    actorProfileId,
                  ).then((r) => ({ ok: r.ok, error: r.ok ? undefined : r.error })),
                'Mehrfachbeschäftigungen gespeichert.',
              )
            }
          />
        </View>
      ) : secondaryRows.length === 0 ? (
        <DetailInfoRow label="Einträge" value="Keine weiteren Beschäftigungen erfasst." />
      ) : null}
    </SectionPanel>
  );
}
