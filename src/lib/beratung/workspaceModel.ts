/** Shared contract for the office and employee consultation workspace. */
export type ConsultationKind = '37_3' | '45';
export type EncounterStatus = 'draft' | 'scheduled' | 'in_progress' | 'documentation_pending' | 'submitted' | 'returned' | 'approved' | 'cancelled' | 'no_show';
export type ConsultationSection = 'preparation' | 'situation' | 'training' | 'measures' | 'confirmation';
export type LearningResult = '' | 'understood' | 'supported' | 'independent' | 'practice_needed';
export type ConsultationParticipant = {
    id: string;
    name: string;
    role: string;
    authority: string;
};
export type ConsultationGoal = {
    id: string;
    title: string;
    method: string;
    practice: string;
    result: LearningResult;
    nextStep: string;
};
export type ConsultationMeasure = {
    id: string;
    title: string;
    owner: string;
    due: string;
    status: 'open' | 'done';
    outcome: string;
};
export type ConsultationAnswers = {
    schemaVersion: 1;
    participants: ConsultationParticipant[];
    clientPerspective: string;
    caregiverPerspective: string;
    situation: string;
    burden: string;
    topics: string[];
    guidance: string;
    careSecured: '' | 'yes' | 'partly' | 'no';
    risk: '' | 'none' | 'clarify' | 'urgent';
    riskNotes: string;
    riskAction: string;
    findingsConsent: '' | 'yes' | 'no';
    goals: ConsultationGoal[];
    materials: string;
    measures: ConsultationMeasure[];
    summary: string;
    followUpDate: string;
    followUpNote: string;
};
export type ConsultationClient = {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    care_grade: string | null;
    payer: string | null;
    insurance_number: string | null;
    access_notes: string | null;
    notes: string | null;
};
export type ConsultationCaseRecord = {
    id: string;
    tenant_id: string;
    client_id: string;
    title: string;
    created_at: string;
    client: ConsultationClient;
};
export type ConsultationEncounter = {
    id: string;
    tenant_id: string;
    case_id: string;
    service_kind: ConsultationKind;
    assigned_employee_id: string | null;
    employee_name: string | null;
    status: EncounterStatus;
    version: number;
    scheduled_start: string | null;
    scheduled_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    preparation: string;
    answers: ConsultationAnswers;
    review_note: string;
    review_section: ConsultationSection | null;
    client_snapshot: ConsultationClient;
    updated_at: string;
    last_read_at: string | null;
    can_execute: boolean;
};
export type ConsultationQualification = {
    employee_id: string;
    service_kind: ConsultationKind;
    valid_from: string;
    valid_until: string | null;
    evidence: string;
    active: boolean;
};
export type ConsultationStaff = {
    id: string;
    name: string;
    qualifications: ConsultationQualification[];
};
export type ConsultationEvent = {
    id: string;
    encounter_id: string;
    action: string;
    note: string;
    created_at: string;
    actor_label: string;
};
export type ConsultationSignature = {
    name: string;
    role: 'client' | 'representative' | 'participant' | 'counselor';
    authority: string;
    image: string;
};
export type ConsultationRevision = {
    id: string;
    encounter_id: string;
    version: number;
    content_hash: string;
    created_at: string;
    snapshot: {
        answers: ConsultationAnswers;
        client: ConsultationClient;
        service_kind: ConsultationKind;
        actual_start: string;
        actual_end: string;
        signatures: ConsultationSignature[];
    };
};
export type ConsultationWorkspace = {
    canManage: boolean;
    canReview: boolean;
    canQualify: boolean;
    employeeView: boolean;
    cases: ConsultationCaseRecord[];
    encounters: ConsultationEncounter[];
    clients: ConsultationClient[];
    employees: ConsultationStaff[];
    events: ConsultationEvent[];
    revisions: ConsultationRevision[];
};
export type ConsultationMutation = 'create' | 'add_visit' | 'plan' | 'read' | 'start' | 'finish' | 'save' | 'submit' | 'return' | 'approve' | 'cancel' | 'no_show' | 'comment' | 'qualify';
export type ConsultationCommand = {
    action: ConsultationMutation;
    requestId: string;
    encounterId?: string | null;
    expectedVersion?: number | null;
    data: Record<string, unknown>;
};
export const KIND_LABELS: Record<ConsultationKind, string> = { '37_3': 'Beratungsbesuch § 37.3', '45': 'Häusliche Schulung § 45' };
export const STATUS_LABELS: Record<EncounterStatus, string> = {
    draft: 'Noch zu planen', scheduled: 'Geplant', in_progress: 'In Durchführung',
    documentation_pending: 'Dokumentation offen', submitted: 'Zur Prüfung', returned: 'Rückfrage',
    approved: 'Fachlich freigegeben', cancelled: 'Abgesagt', no_show: 'Nicht angetroffen',
};
export const EVENT_LABELS: Record<string, string> = {
    create: 'Fall aufgenommen', add_visit: 'Folgetermin angelegt', plan: 'Planung aktualisiert', read: 'Übergabe gelesen',
    start: 'Besuch begonnen', finish: 'Besuch beendet', save: 'Dokumentation gespeichert', submit: 'Zur Prüfung eingereicht',
    return: 'Rückfrage gestellt', approve: 'Fachlich freigegeben', cancel: 'Termin abgesagt', no_show: 'Nicht angetroffen', comment: 'Nachricht',
};
export const TOPICS = ['Pflege im Alltag', 'Mobilität und Transfers', 'Sturz und Wohnumgebung', 'Haut und Druckbelastung',
    'Essen und Trinken', 'Kontinenz', 'Demenz und Kommunikation', 'Arzneimittelorganisation', 'Hygiene',
    'Hitzeschutz', 'Belastung der Pflegeperson', 'Leistungen und Hilfsmittel', 'Notfallvorsorge',
    'Nächtliche Versorgung', 'Schmerz und Wohlbefinden', 'Sehen und Hören', 'Soziale Teilhabe',
    'Entlastungsangebote', 'Anpassung der Wohnumgebung', 'Weiterführende Pflegeberatung'];
export const LEARNING_LABELS: Record<LearningResult, string> = {
    '': 'Bitte einschätzen', understood: 'In eigenen Worten erklärt', supported: 'Mit Unterstützung ausgeführt',
    independent: 'Selbstständig gezeigt', practice_needed: 'Weiterer Übungsbedarf',
};
export const SECTION_LABELS: Record<ConsultationSection, string> = {
    preparation: 'Vorbereitung', situation: 'Situation & Beratung', training: 'Lernziele & Übungen',
    measures: 'Empfehlungen & nächste Schritte', confirmation: 'Prüfen & bestätigen',
};
export function emptyConsultationAnswers(): ConsultationAnswers {
    return { schemaVersion: 1, participants: [], clientPerspective: '', caregiverPerspective: '', situation: '', burden: '',
        topics: [], guidance: '', careSecured: '', risk: '', riskNotes: '', riskAction: '', findingsConsent: '', goals: [],
        materials: '', measures: [], summary: '', followUpDate: '', followUpNote: '' };
}
export function normalizeConsultationAnswers(value: Partial<ConsultationAnswers> | null): ConsultationAnswers {
    const base = emptyConsultationAnswers();
    if (!value || value.schemaVersion !== 1)
        return base;
    return { ...base, ...value, participants: value.participants ?? [], goals: value.goals ?? [], measures: value.measures ?? [], topics: value.topics ?? [] };
}
export type ConsultationIssue = {
    section: ConsultationSection;
    message: string;
};
export function consultationIssues(kind: ConsultationKind, answers: ConsultationAnswers): ConsultationIssue[] {
    const issues: ConsultationIssue[] = [];
    const need = (condition: boolean, section: ConsultationSection, message: string) => { if (!condition)
        issues.push({ section, message }); };
    need(answers.participants.length > 0 && answers.participants.every(p => Boolean(p.name.trim() && p.role.trim())), 'preparation', 'Teilnehmende Personen mit Name und Rolle ergänzen.');
    need(Boolean(answers.situation.trim()), 'situation', 'Die aktuelle Pflegesituation beschreiben.');
    need(Boolean(answers.risk), 'situation', 'Den Handlungsbedarf einschätzen.');
    if (answers.risk === 'clarify' || answers.risk === 'urgent') {
        need(Boolean(answers.riskNotes.trim() && answers.riskAction.trim()), 'situation', 'Auffälligkeit und veranlasste Hilfe dokumentieren.');
    }
    if (kind === '37_3') {
        need(Boolean(answers.clientPerspective.trim() && answers.caregiverPerspective.trim()), 'situation', 'Sicht der pflegebedürftigen Person und der Pflegeperson erfassen; fehlende Beteiligung erläutern.');
        need(answers.topics.length > 0 && Boolean(answers.guidance.trim()), 'situation', 'Besprochene Themen und tatsächlich gegebene Beratung erfassen.');
        need(Boolean(answers.careSecured), 'situation', 'Die Sicherstellung der Pflege einschätzen.');
        need(Boolean(answers.findingsConsent), 'confirmation', 'Entscheidung zur Weitergabe von Erkenntnissen erfassen.');
    }
    else {
        need(answers.goals.length > 0, 'training', 'Mindestens ein Lernziel anlegen.');
        answers.goals.forEach((g, index) => {
            need(Boolean(g.title.trim() && g.method.trim() && g.practice.trim() && g.result), 'training', `Lernziel ${index + 1}: Ziel, Anleitung, Übung und Lernergebnis vervollständigen.`);
            if (g.result === 'practice_needed')
                need(Boolean(g.nextStep.trim()), 'training', `Lernziel ${index + 1}: Weiteres Vorgehen vereinbaren.`);
        });
    }
    answers.measures.forEach((m, index) => {
        need(Boolean(m.title.trim() && m.owner.trim() && /^\d{4}-\d{2}-\d{2}$/.test(m.due)), 'measures', `Empfehlung ${index + 1}: Maßnahme, Zuständigkeit und Termin ergänzen.`);
    });
    need(Boolean(answers.summary.trim()), 'measures', 'Ein gemeinsames Ergebnis festhalten.');
    return issues;
}
export function isEncounterEditable(status: EncounterStatus): boolean {
    return ['in_progress', 'documentation_pending', 'returned'].includes(status);
}
export function nextEncounterAction(encounter: ConsultationEncounter): string {
    switch (encounter.status) {
        case 'draft': return 'Termin und Beratungsperson festlegen';
        case 'scheduled': return 'Besuch vorbereiten';
        case 'in_progress': return 'Durchführung fortsetzen';
        case 'returned': return encounter.review_note || 'Rückfrage bearbeiten';
        case 'documentation_pending': return 'Dokumentation vervollständigen';
        case 'submitted': return 'Fachliche Prüfung ausstehend';
        case 'approved': return 'Freigegebenes Protokoll öffnen';
        default: return STATUS_LABELS[encounter.status];
    }
}
export function consultationPeriod(date: string, careGrade: number, additional = false): {
    start: string;
    end: string;
    label: string;
} {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12)
        throw new Error('Ungültiges Leistungsdatum.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (Number(match[3]) < 1 || Number(match[3]) > new Date(Date.UTC(year, month, 0)).getUTCDate())
        throw new Error('Ungültiges Leistungsdatum.');
    const quarter = additional && careGrade >= 4;
    const startMonth = quarter ? Math.floor((month - 1) / 3) * 3 + 1 : month <= 6 ? 1 : 7;
    const endMonth = startMonth + (quarter ? 2 : 5);
    const day = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return { start: `${year}-${String(startMonth).padStart(2, '0')}-01`, end: `${year}-${String(endMonth).padStart(2, '0')}-${day}`,
        label: quarter ? `Zusätzlicher Quartalsbesuch ${Math.ceil(month / 3)}/${year}` : `${month <= 6 ? '1.' : '2.'} Halbjahr ${year}` };
}
