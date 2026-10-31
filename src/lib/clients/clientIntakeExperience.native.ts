// Generated native presentation from src/lib/clients/clientIntakeExperience.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { IntakeSectionKey } from './clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { validateIntakeStep } from './clientIntakeValidation';
export const INTAKE_WEB_SECTIONS: Record<IntakeSectionKey, {
    label: string;
    description: string;
    phase: string;
}> = {
    leistungsart: { label: 'Unterstützung wählen', description: 'Welche Unterstützung wird gebraucht?', phase: 'Aufnahme vorbereiten' },
    stammdaten: { label: 'Persönliche Angaben', description: 'Die Person hinter der Akte', phase: 'Person kennenlernen' },
    adresse_kontakt: { label: 'Adresse & Kontakt', description: 'Erreichbarkeit und Einsatzadresse', phase: 'Person kennenlernen' },
    versorgung: { label: 'Wünsche & Versorgung', description: 'Unterstützung im Alltag abstimmen', phase: 'Versorgung abstimmen' },
    kostentraeger: { label: 'Kosten & Versicherung', description: 'Finanzierung und Versicherungsdaten', phase: 'Versorgung abstimmen' },
    angehoerige: { label: 'Kontaktpersonen', description: 'Eine vertraute Ansprechperson', phase: 'Umfeld einbeziehen' },
    notfall_zugang: { label: 'Zugang & Sicherheit', description: 'Gut vorbereitet zum ersten Besuch', phase: 'Umfeld einbeziehen' },
    vertraege_einwilligungen: { label: 'Verträge & Einwilligungen', description: 'Vereinbarungen gemeinsam durchgehen', phase: 'Unterlagen vorbereiten' },
    dokumente: { label: 'Weitere Unterlagen', description: 'Passende Dokumente zur Aufnahme', phase: 'Unterlagen vorbereiten' },
    module: { label: 'Zuständigkeiten', description: 'Die beteiligten Arbeitsbereiche', phase: 'Aufnahme prüfen' },
    pruefung: { label: 'Prüfen & sichern', description: 'Alle Angaben im Überblick', phase: 'Aufnahme prüfen' },
};
export function getIntakeWebFeedback(message: string) {
    if (message.startsWith('Entwurf lokal erhalten.') && message.includes('Serversicherung unterschriebener oder finaler Aufnahmeunterlagen ist gesperrt')) {
        return 'Der Entwurf mit den erfassten Unterschriften ist auf diesem Gerät erhalten. Diese Unterlagen können derzeit noch nicht im Unternehmen gesichert werden. Verwenden Sie dasselbe Gerät, um später weiterzuarbeiten.';
    }
    if (message.startsWith('Unterschriebene Aufnahmeunterlagen bleiben unveränderlich.')) {
        return 'Bereits unterschriebene Unterlagen können hier nicht geändert werden. Bearbeiten Sie die persönlichen Angaben über den jeweiligen Abschnitt der Klientenakte. Die vorhandenen Originale bleiben erhalten.';
    }
    return message;
}
/** A valid empty optional section only counts after it has actually been visited. */
export function getIntakeWebProgress(form: ClientIntakeFormData, steps: IntakeSectionKey[], visited: ReadonlySet<IntakeSectionKey>) {
    const completed = steps.filter(section => section !== 'pruefung' && visited.has(section) &&
        Object.values(validateIntakeStep(section, form)).every(value => !value));
    const percentage = form.careContexts.length && steps.length > 1
        ? Math.min(99, Math.round(completed.length / steps.length * 100)) : 0;
    return { completed, percentage };
}
