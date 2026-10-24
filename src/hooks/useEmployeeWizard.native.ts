// Generated native presentation from src/hooks/useEmployeeWizard.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useRef, useState } from 'react';
import type { EmployeeFormData, EmployeeFormErrors } from '@/types/forms/employeeForm';
import { EMPTY_EMPLOYEE_FORM } from '@/types/forms/employeeForm';
import { validateEmployeeForm } from '@/lib/office/employeeFormValidation';
import { createPersonnelProfile } from "../lib/office/createPersonnelProfile.native.ts";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
export function useEmployeeWizard() {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const [form, setForm] = useState<EmployeeFormData>({ ...EMPTY_EMPLOYEE_FORM, status: 'entwurf' });
    const [errors, setErrors] = useState<EmployeeFormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const lock = useRef(false);
    const updateField = useCallback(<K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
        setForm(previous => ({ ...previous, [key]: value }));
        setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    }, []);
    const submit = useCallback(async () => {
        if (lock.current || createdId)
            return null;
        const invalid = validateEmployeeForm(form);
        if (Object.keys(invalid).length) {
            setErrors(invalid);
            return null;
        }
        if (!tenantId) {
            setSubmitError('Ihre Unternehmenszuordnung fehlt. Bitte melden Sie sich erneut an.');
            return null;
        }
        lock.current = true;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const result = await createPersonnelProfile(tenantId, form, profile?.roleKey);
            if (!result.ok) {
                setSubmitError(result.error);
                return null;
            }
            setWarning(result.data.warning ?? null);
            setCreatedId(result.data.id);
            return result.data.id;
        }
        catch {
            setSubmitError('Die Anlage konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Personalübersicht, bevor Sie die Person erneut anlegen.');
            return null;
        }
        finally {
            lock.current = false;
            setSubmitting(false);
        }
    }, [createdId, form, tenantId, profile?.roleKey]);
    const cancel = useCallback(() => { setForm({ ...EMPTY_EMPLOYEE_FORM, status: 'entwurf' }); setErrors({}); setSubmitError(null); setCreatedId(null); setWarning(null); }, []);
    return { form, errors, submitting, submitError, createdId, warning, updateField, submit, cancel, isSuccess: !!createdId };
}
