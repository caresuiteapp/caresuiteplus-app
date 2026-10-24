// Generated native presentation from src/features/akademie/AcademyWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvg,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeH3,NativeP,NativeSpan,NativeStrong,NativeArticle,NativeButton,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeSection,NativeH2,NativeOl,NativeLi,NativeStyle,NativeHeader,NativeH1,NativeNav,NativeFieldset,NativeSmall,NativeTextarea,NativeDetails,NativeSummary,NativeA,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ACADEMY_AUDIENCE_LABELS, ACADEMY_STATE_LABELS, academySafeResourceUrl, isAcademyOverdue, type AcademyAudience, type AcademyCertificate, type AcademyCommandHandler, type AcademyContent, type AcademyCourse, type AcademyEnrollment, type AcademyParticipant, type AcademySection, type AcademyView, type AcademyWorkspace, type AcademyReusableTemplate, } from '@/lib/akademie/workspaceModel';
import { createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
import { cloneAcademyContent } from '@/lib/akademie/workspaceAuthoring';
import { AcademyCourseEditor } from "./AcademyCourseEditor.native.tsx";
import { AcademyTemplateLibrary } from "./AcademyTemplateLibrary.native.tsx";
import { AcademyLearningPlayer } from "./AcademyLearningPlayer.native.tsx";
import { AcademyPlanning } from "./AcademyPlanning.native.tsx";
import { AcademyReports } from "./AcademyReports.native.tsx";
import { academyStyles } from './academyStyles';
export type AcademyWorkspaceViewProps = {
    workspace: AcademyWorkspace | null;
    loading: boolean;
    busy: boolean;
    error: string | null;
    notice: string | null;
    view: AcademyView;
    initialSection?: AcademySection;
    initialAudience?: AcademyAudience;
    initialMandatoryOnly?: boolean;
    initialCourseId?: string;
    initialEnrollmentId?: string;
    createInitially?: boolean;
    onCommand: AcademyCommandHandler;
    onReload: () => void;
    onDownloadCertificate: (certificate: AcademyCertificate) => Promise<void>;
};
const courseLabels: Record<AcademyCourse['status'], string> = { draft: 'Entwurf', published: 'Veröffentlicht', archived: 'Archiviert' };
const officeSections: {
    key: AcademySection;
    label: string;
}[] = [
    { key: 'overview', label: 'Übersicht' }, { key: 'courses', label: 'Kurse' },
    { key: 'templates', label: 'Vorlagen' },
    { key: 'planning', label: 'Schulungsplan' }, { key: 'assignments', label: 'Zuweisungen' }, { key: 'reviews', label: 'Abschlüsse prüfen' },
    { key: 'certificates', label: 'Nachweise' }, { key: 'reports', label: 'Auswertungen' }, { key: 'library', label: 'Wissen & Materialien' },
];
const learnerSections: {
    key: AcademySection;
    label: string;
}[] = [
    { key: 'overview', label: 'Meine Schulungen' }, { key: 'planning', label: 'Mein Schulungsplan' }, { key: 'certificates', label: 'Meine Nachweise' }, { key: 'library', label: 'Lernmaterialien' },
];
const audienceKeys: AcademyAudience[] = ['employee', 'client', 'family'];
const personKey = (participant: Pick<AcademyParticipant, 'id' | 'kind'>) => `${participant.kind}:${participant.id}`;
const dateText = (date: string | null) => {
    if (!date)
        return 'Ohne Frist';
    const value = new Date(`${date.slice(0, 10)}T12:00:00`);
    return Number.isNaN(value.getTime()) ? 'Datum nicht verfügbar' : value.toLocaleDateString('de-DE');
};
const normalized = (value: string) => value.toLocaleLowerCase('de-DE').trim();
const toneForState = (state: AcademyEnrollment['state']) => state === 'completed' ? 'good' : state === 'returned' || state === 'submitted' ? 'attention' : 'neutral';
function Empty({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[academyStyles]}>{<NativeDiv className="ac-empty"><NativeH3>{title}</NativeH3><NativeP>{children}</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
}
function Progress({ value, label }: {
    value: number;
    label: string;
}) {
    const progress = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    return <NativeWorkspaceStyleScope css={[academyStyles]}>{<><NativeDiv className="ac-stat-line"><NativeSpan>{label}</NativeSpan><NativeStrong>{progress} %</NativeStrong></NativeDiv><NativeDiv className="ac-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><NativeSpan style={{ width: `${progress}%` }}/></NativeDiv></>}</NativeWorkspaceStyleScope>;
}
function EnrollmentCard({ enrollment, busy, onOpen }: {
    enrollment: AcademyEnrollment;
    busy: boolean;
    onOpen: () => void;
}) {
    return <NativeWorkspaceStyleScope css={[academyStyles]}>{<NativeArticle className="ac-course-card">
    <NativeDiv className="ac-course-cover" data-tone={enrollment.content.mandatory ? '1' : '0'}><NativeSpan className="ac-eyebrow">{enrollment.content.category || 'LERNANGEBOT'}</NativeSpan><NativeH3 className="ac-course-title">{enrollment.content.title}</NativeH3><NativeSpan>{enrollment.content.estimatedMinutes} Minuten · {enrollment.content.lessons.length} Lektionen</NativeSpan></NativeDiv>
    <NativeDiv className="ac-course-meta"><NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={toneForState(enrollment.state)}>{ACADEMY_STATE_LABELS[enrollment.state]}</NativeSpan>{enrollment.content.mandatory && <NativeSpan className="ac-status" data-tone="attention">Verpflichtend</NativeSpan>}</NativeDiv><NativeP>{enrollment.content.summary}</NativeP><Progress value={enrollment.progress} label="Bearbeitet"/><NativeP className="ac-muted">{enrollment.dueDate ? `Frist: ${dateText(enrollment.dueDate)}` : 'Lernen ohne feste Frist'}{isAcademyOverdue(enrollment) ? ' · Überfällig' : ''}</NativeP>{enrollment.reviewNote && <NativeP className="ac-message" data-tone="info">{enrollment.reviewNote}</NativeP>}<NativeButton type="button" className="ac-button primary" disabled={busy} onClick={onOpen}>{enrollment.state === 'assigned' ? 'Schulung öffnen' : ['submitted', 'completed', 'cancelled'].includes(enrollment.state) ? 'Lernstand ansehen' : 'Weiterlernen'}</NativeButton></NativeDiv>
  </NativeArticle>}</NativeWorkspaceStyleScope>;
}
export function AcademyWorkspaceView({ workspace, loading, busy, error, notice, view, initialSection = 'overview', initialAudience, initialMandatoryOnly = false, initialCourseId, initialEnrollmentId, createInitially = false, onCommand, onReload, onDownloadCertificate }: AcademyWorkspaceViewProps) {
    const [section, setSection] = useState<AcademySection>(initialSection);
    const [audience, setAudience] = useState<AcademyAudience | 'all'>(initialAudience ?? 'all');
    const [search, setSearch] = useState('');
    const [mandatoryOnly, setMandatoryOnly] = useState(initialMandatoryOnly);
    const [courseStatus, setCourseStatus] = useState<AcademyCourse['status'] | 'all'>('all');
    const [enrollmentStatus, setEnrollmentStatus] = useState<AcademyEnrollment['state'] | 'all' | 'overdue'>('all');
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId ?? null);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(initialEnrollmentId ?? null);
    const [courseRouteDismissed, setCourseRouteDismissed] = useState(false);
    const [editor, setEditor] = useState<{
        id: string;
        mode: 'course' | 'template';
        course: AcademyCourse | null;
        content: AcademyContent;
        template?: AcademyReusableTemplate | null;
    } | null>(null);
    const [assignCourseId, setAssignCourseId] = useState<string | null>(null);
    const [targetSearch, setTargetSearch] = useState('');
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');
    const [reviewId, setReviewId] = useState<string | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [resolvedReviews, setResolvedReviews] = useState<Record<string, number>>({});
    const [archiveId, setArchiveId] = useState<string | null>(null);
    const [archivedIds, setArchivedIds] = useState<string[]>([]);
    const [cancelId, setCancelId] = useState<string | null>(null);
    const [cancelNote, setCancelNote] = useState('');
    const [cancelledIds, setCancelledIds] = useState<string[]>([]);
    const [revokeId, setRevokeId] = useState<string | null>(null);
    const [revokeNote, setRevokeNote] = useState('');
    const [revokedIds, setRevokedIds] = useState<string[]>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const isOffice = view === 'office';
    const capabilities = workspace?.capabilities;
    const courses = useMemo(() => (workspace?.courses ?? []).map(course => archivedIds.includes(course.id) ? { ...course, status: 'archived' as const } : course), [workspace?.courses, archivedIds]);
    const enrollments = useMemo(() => (workspace?.enrollments ?? []).map(enrollment => cancelledIds.includes(enrollment.id) ? { ...enrollment, state: 'cancelled' as const } : enrollment), [workspace?.enrollments, cancelledIds]);
    const certificates = workspace?.certificates ?? [];
    const selectedCourse = courses.find(course => course.id === selectedCourseId) ?? null;
    const selectedEnrollment = enrollments.find(enrollment => enrollment.id === selectedEnrollmentId) ?? (!isOffice && initialCourseId && !courseRouteDismissed ? enrollments.find(enrollment => enrollment.courseId === initialCourseId) : null) ?? null;
    const assignCourse = courses.find(course => course.id === assignCourseId) ?? null;
    const reviewEnrollment = enrollments.find(enrollment => enrollment.id === reviewId) ?? null;
    const archiveCourse = courses.find(course => course.id === archiveId) ?? null;
    const cancelEnrollment = enrollments.find(enrollment => enrollment.id === cancelId) ?? null;
    const certificateToRevoke = certificates.find(certificate => certificate.id === revokeId) ?? null;
    const query = normalized(search);
    const matchesAudience = (enrollment: AcademyEnrollment) => audience === 'all' || enrollment.participant.kind === audience;
    const scopedEnrollments = enrollments.filter(enrollment => matchesAudience(enrollment) && (!mandatoryOnly || enrollment.content.mandatory));
    const enrollmentById = new Map(enrollments.map(enrollment => [enrollment.id, enrollment]));
    const reportEnrollments = scopedEnrollments.filter(enrollment => normalized(`${enrollment.content.title} ${enrollment.participant.name} ${enrollment.participant.contextLabel}`).includes(query));
    const reportEnrollmentIds = new Set(reportEnrollments.map(enrollment => enrollment.id));
    const reportCertificates = certificates.filter(certificate => reportEnrollmentIds.has(certificate.enrollmentId));
    const reportCourses = courses.filter(course => (audience === 'all' || course.content.audiences.includes(audience)) && (!mandatoryOnly || course.content.mandatory) && normalized(`${course.content.title} ${course.content.summary} ${course.content.category}`).includes(query));
    const reviews = reportEnrollments.filter(enrollment => enrollment.state === 'submitted' && (resolvedReviews[enrollment.id] === undefined || enrollment.revision > resolvedReviews[enrollment.id]!));
    const filteredCourses = courses.filter(course => (audience === 'all' || course.content.audiences.includes(audience)) && (!mandatoryOnly || course.content.mandatory) && (courseStatus === 'all' || course.status === courseStatus) && normalized(`${course.content.title} ${course.content.summary} ${course.content.category}`).includes(query));
    const filteredEnrollments = scopedEnrollments.filter(enrollment => (!isOffice || !selectedEnrollmentId || enrollment.id === selectedEnrollmentId) && (enrollmentStatus === 'all' || (enrollmentStatus === 'overdue' ? isAcademyOverdue(enrollment) : enrollment.state === enrollmentStatus)) && normalized(`${enrollment.content.title} ${enrollment.participant.name} ${enrollment.participant.contextLabel}`).includes(query));
    const filteredCertificates = certificates.filter(certificate => (!selectedEnrollmentId || certificate.enrollmentId === selectedEnrollmentId) && (audience === 'all' || certificate.audience === audience) && (!mandatoryOnly || enrollmentById.get(certificate.enrollmentId)?.content.mandatory) && normalized(`${certificate.courseTitle} ${certificate.participantName} ${certificate.number}`).includes(query));
    const availableTargets = (workspace?.participants ?? []).filter(participant => assignCourse?.content.audiences.includes(participant.kind) && (audience === 'all' || participant.kind === audience) && normalized(`${participant.name} ${participant.contextLabel}`).includes(normalized(targetSearch)));
    const courseTargets = (workspace?.participants ?? []).filter(participant => assignCourse?.content.audiences.includes(participant.kind));
    const readyTargets = availableTargets.filter(participant => participant.portalReady);
    const materials = isOffice
        ? courses.filter(course => course.status === 'published' && (!mandatoryOnly || course.content.mandatory) && (audience === 'all' || course.content.audiences.includes(audience))).flatMap(course => course.content.lessons.filter(lesson => lesson.kind !== 'quiz').map(lesson => ({ lesson, courseTitle: course.content.title, key: `${course.id}:${lesson.id}` })))
        : enrollments.filter(enrollment => enrollment.state !== 'cancelled' && (!mandatoryOnly || enrollment.content.mandatory)).flatMap(enrollment => enrollment.content.lessons.filter(lesson => lesson.kind !== 'quiz').map(lesson => ({ lesson, courseTitle: enrollment.content.title, key: `${enrollment.versionId}:${lesson.id}` })));
    const filteredMaterials = materials.filter((material, index, list) => list.findIndex(value => value.key === material.key) === index && normalized(`${material.lesson.title} ${material.courseTitle} ${material.lesson.body}`).includes(query));
    useEffect(() => { setSection(initialSection); }, [initialSection]);
    useEffect(() => { setAudience(initialAudience ?? 'all'); }, [initialAudience]);
    useEffect(() => { setMandatoryOnly(initialMandatoryOnly); }, [initialMandatoryOnly]);
    useEffect(() => { setSelectedCourseId(initialCourseId ?? null); setCourseRouteDismissed(false); }, [initialCourseId]);
    useEffect(() => { setSelectedEnrollmentId(initialEnrollmentId ?? null); }, [initialEnrollmentId]);
    useEffect(() => { if (createInitially)
        setSection('templates'); }, [createInitially]);
    const go = (next: AcademySection) => { setSection(next); setSearch(''); setSelectedEnrollmentId(null); setCourseRouteDismissed(true); setSelectedCourseId(null); };
    const create = (content: AcademyContent) => { setEditor({ id: crypto.randomUUID(), mode: 'course', course: null, content: cloneAcademyContent(content) }); setSelectedCourseId(null); setSection('courses'); };
    const edit = (course: AcademyCourse) => { setEditor({ id: course.id, mode: 'course', course, content: course.content }); setSelectedCourseId(null); setSection('courses'); };
    const copyCourse = (course: AcademyCourse) => create({ ...course.content, title: `${course.content.title} – Kopie`.slice(0, 250) });
    const editTemplate = (template: AcademyReusableTemplate) => { setEditor({ id: template.id, mode: 'template', course: null, content: template.content, template }); setSection('templates'); };
    const createTemplate = () => { setEditor({ id: crypto.randomUUID(), mode: 'template', course: null, content: createAcademyTemplate('blank'), template: null }); setSection('templates'); };
    const beginAssign = (course: AcademyCourse) => { setAssignCourseId(course.id); setSelectedTargets([]); setTargetSearch(''); setDueDate(''); setSection('assignments'); setSelectedCourseId(null); };
    const assign = async () => {
        if (!assignCourse || assignCourse.status !== 'published')
            return;
        const targets = courseTargets.filter(participant => participant.portalReady && selectedTargets.includes(personKey(participant))).map(participant => ({ kind: participant.kind, id: participant.id }));
        if (!targets.length)
            return;
        const result = await onCommand('assign', { targets, dueDate: dueDate || null }, assignCourse);
        if (result) {
            setAssignCourseId(null);
            setSelectedTargets([]);
        }
    };
    const review = async (decision: 'approve' | 'return') => {
        if (!reviewEnrollment)
            return;
        const result = await onCommand('review_enrollment', { decision, note: reviewNote.trim(), validUntil: validUntil || null }, reviewEnrollment);
        if (result) {
            setResolvedReviews(previous => ({ ...previous, [reviewEnrollment.id]: result.revision }));
            setReviewId(null);
            setReviewNote('');
            setValidUntil('');
        }
    };
    const archive = async () => {
        if (!archiveCourse)
            return;
        const result = await onCommand('archive_course', {}, archiveCourse);
        if (result) {
            setArchivedIds(previous => [...previous, archiveCourse.id]);
            setArchiveId(null);
        }
    };
    const cancel = async () => {
        if (!cancelEnrollment || cancelNote.trim().length < 3)
            return;
        const result = await onCommand('cancel_enrollment', { note: cancelNote.trim() }, cancelEnrollment);
        if (result) {
            setCancelledIds(previous => [...previous, cancelEnrollment.id]);
            setCancelId(null);
            setCancelNote('');
        }
    };
    const revoke = async () => {
        if (!certificateToRevoke || revokeNote.trim().length < 3)
            return;
        const result = await onCommand('revoke_certificate', { note: revokeNote.trim() }, { id: certificateToRevoke.id, revision: null });
        if (result) {
            setRevokedIds(previous => [...previous, certificateToRevoke.id]);
            setRevokeId(null);
            setRevokeNote('');
        }
    };
    const download = async (certificate: AcademyCertificate) => {
        setDownloadingId(certificate.id);
        setDownloadError(null);
        try {
            await onDownloadCertificate(certificate);
        }
        catch {
            setDownloadError('Der Nachweis konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            setDownloadingId(null);
        }
    };
    const toolbar = <NativeDiv className="ac-toolbar"><NativeLabel className="ac-field ac-search">Suchen<NativeInput className="ac-input" type="search" value={search} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder={['assignments', 'certificates', 'planning', 'reports'].includes(section) ? 'Name oder Schulung suchen…' : 'Titel oder Thema suchen…'}/></NativeLabel>{isOffice && <NativeLabel className="ac-field">Zielgruppe<NativeSelect className="ac-input" value={audience} disabled={busy} onChange={event => setAudience(event.target.value as AcademyAudience | 'all')}><NativeOption value="all">Alle Zielgruppen</NativeOption>{audienceKeys.map(key => <NativeOption key={key} value={key}>{ACADEMY_AUDIENCE_LABELS[key]}</NativeOption>)}</NativeSelect></NativeLabel>}{section === 'courses' && isOffice && <NativeLabel className="ac-field">Kursstatus<NativeSelect className="ac-input" value={courseStatus} disabled={busy} onChange={event => setCourseStatus(event.target.value as AcademyCourse['status'] | 'all')}><NativeOption value="all">Alle Kurse</NativeOption>{Object.entries(courseLabels).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>}{(section === 'assignments' || (!isOffice && section === 'overview')) && <NativeLabel className="ac-field">Lernstand<NativeSelect className="ac-input" value={enrollmentStatus} disabled={busy} onChange={event => setEnrollmentStatus(event.target.value as typeof enrollmentStatus)}><NativeOption value="all">Alle Lernstände</NativeOption><NativeOption value="overdue">Überfällig</NativeOption>{Object.entries(ACADEMY_STATE_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>}<NativeLabel className="ac-checkbox-label"><NativeInput type="checkbox" checked={mandatoryOnly} disabled={busy} onChange={event => setMandatoryOnly(event.target.checked)}/>Nur Pflichtschulungen</NativeLabel></NativeDiv>;
    const renderCourseCard = (course: AcademyCourse, index: number) => <NativeArticle className="ac-course-card" key={course.id}><NativeDiv className="ac-course-cover" data-tone={String(index % 4)}><NativeSpan className="ac-eyebrow">{course.content.category || 'KURS'}</NativeSpan><NativeH3 className="ac-course-title">{course.content.title}</NativeH3><NativeSpan>{course.content.estimatedMinutes} Minuten · {course.content.lessons.length} Lektionen</NativeSpan></NativeDiv><NativeDiv className="ac-course-meta"><NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={course.status === 'published' ? 'good' : 'neutral'}>{courseLabels[course.status]}</NativeSpan>{course.content.mandatory && <NativeSpan className="ac-status" data-tone="attention">Verpflichtend</NativeSpan>}</NativeDiv><NativeP>{course.content.summary || 'Noch keine Kurzbeschreibung hinterlegt.'}</NativeP><NativeP className="ac-muted">{course.content.audiences.map(value => ACADEMY_AUDIENCE_LABELS[value]).join(' · ') || 'Zielgruppe noch offen'}</NativeP><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => { setSelectedCourseId(course.id); setSection('courses'); }}>Details</NativeButton>{capabilities?.manageCourses && course.status !== 'archived' && <NativeButton type="button" className="ac-button" disabled={busy} onClick={() => edit(course)}>Bearbeiten</NativeButton>}{capabilities?.manageCourses && <NativeButton type="button" className="ac-button subtle small" disabled={busy} aria-label={`Kurs kopieren: ${course.content.title}`} onClick={() => copyCourse(course)}>Kopieren</NativeButton>}{capabilities?.assign && course.status === 'published' && <NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => beginAssign(course)}>Zuweisen</NativeButton>}</NativeDiv></NativeDiv></NativeArticle>;
    const courseDetail = selectedCourse && <NativeSection className="ac-panel" aria-label="Kursdetails"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">KURSDETAILS</NativeP><NativeH2 className="ac-section-title">{selectedCourse.content.title}</NativeH2><NativeP>{selectedCourse.content.summary}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setSelectedCourseId(null)}>Details schließen</NativeButton></NativeDiv><NativeDiv className="ac-badges"><NativeSpan className="ac-status" data-tone={selectedCourse.status === 'published' ? 'good' : 'neutral'}>{courseLabels[selectedCourse.status]}</NativeSpan><NativeSpan className="ac-muted">{selectedCourse.versionNumber > 0 ? `Zuletzt veröffentlichte Fassung: ${selectedCourse.versionNumber}` : 'Noch keine veröffentlichte Fassung'}</NativeSpan></NativeDiv><NativeOl className="ac-list">{selectedCourse.content.lessons.map(lesson => <NativeLi className="ac-list-row" key={lesson.id}><NativeDiv className="ac-list-main"><NativeStrong>{lesson.title || 'Unbenannte Lektion'}</NativeStrong><NativeSpan className="ac-muted">{lesson.kind === 'quiz' ? `Wissenscheck · ${lesson.questions?.length ?? 0} Fragen` : lesson.kind === 'text' ? 'Lesetext' : lesson.kind === 'video' ? 'Video' : 'Dokument'}</NativeSpan></NativeDiv></NativeLi>)}</NativeOl><NativeDiv className="ac-card-actions">{capabilities?.manageCourses && selectedCourse.status !== 'archived' && <><NativeButton type="button" className="ac-button" disabled={busy} onClick={() => edit(selectedCourse)}>Kurs bearbeiten</NativeButton><NativeButton type="button" className="ac-button danger" disabled={busy} onClick={() => setArchiveId(selectedCourse.id)}>Archivieren</NativeButton></>}{capabilities?.manageCourses && <NativeButton type="button" className="ac-button" disabled={busy} onClick={() => copyCourse(selectedCourse)}>Als neuen Kurs kopieren</NativeButton>}{capabilities?.assign && selectedCourse.status === 'published' && <NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => beginAssign(selectedCourse)}>Personen zuweisen</NativeButton>}</NativeDiv>{selectedCourse.status === 'draft' && <NativeP className="ac-muted">Vor neuen Zuweisungen muss der aktuelle Entwurf veröffentlicht werden. Bestehende Teilnahmen behalten ihre bisherige Fassung.</NativeP>}</NativeSection>;
    return <NativeWorkspaceStyleScope css={[academyStyles, academyStyles]}>{<NativeDiv className="academy-workspace" aria-busy={loading || busy}>
    <NativeStyle>{academyStyles}</NativeStyle>
    <NativeHeader className="ac-header"><NativeDiv className="ac-brand-mark" aria-hidden="true"><NativeSvg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><NativeSvgPath d="M4 7c4-1 8 0 12 3 4-3 8-4 12-3v18c-4-1-8 0-12 3-4-3-8-4-12-3V7Z"/><NativeSvgPath d="M16 10v18M8 12l4 1.5M8 17l4 1.5M20 13.5l4-1.5M20 18.5l4-1.5"/></NativeSvg></NativeDiv><NativeDiv className="ac-header-copy"><NativeP className="ac-eyebrow">CARESUITE+ AKADEMIE</NativeP><NativeH1>{isOffice ? 'Wissen weitergeben. Lernen begleiten.' : 'Ihr nächster Lernschritt.'}</NativeH1><NativeP>{isOffice ? 'Kurse gestalten, Schulungen zuweisen und Abschlüsse gemeinsam verfolgen.' : 'Ihre Schulungen, gespeicherten Lernschritte und persönlichen Nachweise an einem Ort.'}</NativeP></NativeDiv><NativeDiv className="ac-header-actions"><NativeButton type="button" className="ac-button subtle" disabled={busy || loading || Boolean(editor)} onClick={onReload}>Aktualisieren</NativeButton>{isOffice && capabilities?.manageCourses && <NativeButton type="button" className="ac-button primary" disabled={busy || Boolean(editor)} onClick={() => go('templates')}>+ Kurs anlegen</NativeButton>}</NativeDiv></NativeHeader>
    <NativeNav className="ac-tabs" aria-label={isOffice ? 'Akademiebereiche' : 'Mein Lernbereich'}>{(isOffice ? officeSections.filter(item => item.key !== 'templates' || capabilities?.manageCourses) : learnerSections).map(item => <NativeButton type="button" className="ac-tab" aria-current={(section === item.key || (!isOffice && !['certificates', 'library', 'planning'].includes(section) && item.key === 'overview')) ? 'page' : undefined} key={item.key} disabled={busy || Boolean(editor)} onClick={() => go(item.key)}>{item.label}{item.key === 'reviews' && reviews.length > 0 && !error ? ` (${reviews.length})` : ''}</NativeButton>)}</NativeNav>
    {error && <NativeDiv className="ac-message" data-tone="error" role="alert"><NativeStrong>Der Vorgang konnte nicht vollständig abgeschlossen werden.</NativeStrong><NativeP>{error}</NativeP>{workspace && <NativeP>Die angezeigten Einträge entsprechen dem zuletzt geladenen Stand.</NativeP>}</NativeDiv>}
    {notice && <NativeDiv className="ac-message" data-tone="success" role="status">{notice}</NativeDiv>}
    {downloadError && <NativeDiv className="ac-message" data-tone="error" role="alert">{downloadError}</NativeDiv>}
    {!workspace ? loading ? <NativeDiv className="ac-panel ac-skeleton" role="status"><NativeH2>Akademie wird geladen…</NativeH2><NativeP>Kurse, Berechtigungen und Lernstände werden abgerufen.</NativeP></NativeDiv> : <NativeDiv className="ac-panel"><Empty title="Akademie noch nicht verfügbar">Die Daten konnten noch nicht geladen werden. Versuchen Sie es erneut.</Empty><NativeButton type="button" className="ac-button" disabled={busy} onClick={onReload}>Erneut laden</NativeButton></NativeDiv> : <>
      {editor ? <AcademyCourseEditor key={`${editor.mode}:${editor.id}`} mode={editor.mode} course={editor.mode === 'course' ? courses.find(course => course.id === editor.id) ?? editor.course : null} template={editor.mode === 'template' ? workspace.templates?.find(template => template.id === editor.id) ?? editor.template ?? null : undefined} templates={workspace.templates ?? []} draftId={editor.id} initialContent={editor.content} busy={busy || !capabilities?.manageCourses} onCommand={onCommand} onClose={() => setEditor(null)}/> : <>
        {isOffice && section === 'overview' && <>{toolbar}
          {!error && !loading && <NativeDiv className="ac-kpis"><NativeDiv className="ac-kpi"><NativeSpan>Veröffentlichte Kurse</NativeSpan><NativeStrong className="ac-kpi-value">{reportCourses.filter(course => course.status === 'published').length}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Laufende Schulungen</NativeSpan><NativeStrong className="ac-kpi-value">{reportEnrollments.filter(enrollment => ['assigned', 'in_progress', 'returned'].includes(enrollment.state)).length}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Zur Prüfung eingereicht</NativeSpan><NativeStrong className="ac-kpi-value">{reviews.length}</NativeStrong></NativeDiv><NativeDiv className="ac-kpi"><NativeSpan>Frist überschritten</NativeSpan><NativeStrong className="ac-kpi-value">{reportEnrollments.filter(enrollment => isAcademyOverdue(enrollment)).length}</NativeStrong></NativeDiv></NativeDiv>}
          <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Die nächsten Schritte</NativeH2><NativeP className="ac-muted">Offene Abschlüsse und fällige Schulungen im Blick behalten.</NativeP></NativeDiv></NativeDiv><NativeDiv className="ac-card-actions">{capabilities?.review && <NativeButton type="button" className="ac-button" disabled={busy} onClick={() => go('reviews')}>Abschlüsse prüfen</NativeButton>}<NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => { go('assignments'); setEnrollmentStatus('overdue'); }}>Überfällige Schulungen</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => go('certificates')}>Nachweise ansehen</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => go('planning')}>Schulungsplan öffnen</NativeButton></NativeDiv></NativeSection>
          <NativeDiv className="ac-panel-header"><NativeH2 className="ac-section-title">Im Kurskatalog</NativeH2><NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => go('courses')}>Alle Kurse</NativeButton></NativeDiv>{reportCourses.some(course => course.status !== 'archived') ? <NativeDiv className="ac-card-grid">{reportCourses.filter(course => course.status !== 'archived').slice(0, 4).map(renderCourseCard)}</NativeDiv> : <NativeSection className="ac-panel"><Empty title={courses.length ? 'Keine passenden Kurse' : 'Raum für Ihr Wissen'}>{courses.length ? 'Passen Sie die Suche oder die Filter an.' : 'Legen Sie den ersten Kurs an. Eine Strukturvorlage unterstützt Sie bei Aufbau, Lernzielen und Wissenschecks.'}</Empty>{capabilities?.manageCourses && <NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => go('templates')}>Ersten Kurs gestalten</NativeButton>}</NativeSection>}
        </>}
        {isOffice && section === 'templates' && (capabilities?.manageCourses ? <AcademyTemplateLibrary templates={workspace.templates ?? []} busy={busy} onCommand={onCommand} onUseContent={create} onEditTemplate={editTemplate} onCreateBlank={() => create(createAcademyTemplate('blank'))} onCreateTemplate={createTemplate}/> : <NativeSection className="ac-panel"><Empty title="Vorlagen sind für Kursredakteure vorgesehen">Für die Verwaltung eigener Kursvorlagen benötigen Sie die Berechtigung zur Kursbearbeitung.</Empty></NativeSection>)}
        {isOffice && section === 'courses' && <>
          {courseDetail}{toolbar}{filteredCourses.length ? <NativeDiv className="ac-card-grid">{filteredCourses.map(renderCourseCard)}</NativeDiv> : <NativeSection className="ac-panel"><Empty title={courses.length ? 'Keine passenden Kurse' : 'Noch keine Kurse'}>{courses.length ? 'Passen Sie die Suche oder die Filter an.' : 'Beginnen Sie mit einem neuen Kurs oder einer Strukturvorlage.'}</Empty></NativeSection>}
        </>}
        {section === 'planning' && <>{toolbar}<AcademyPlanning workspace={{ ...workspace, courses, enrollments }} busy={busy} onCommand={onCommand} audience={audience} query={query} mandatoryOnly={mandatoryOnly} onOpenEnrollment={id => { setSelectedEnrollmentId(id); setSection(isOffice ? 'assignments' : 'overview'); setEnrollmentStatus('all'); setSearch(''); setMandatoryOnly(false); setAudience('all'); }}/></>}
        {isOffice && section === 'reports' && <>{toolbar}<AcademyReports workspace={workspace} enrollments={reportEnrollments} courses={reportCourses} certificates={reportCertificates} busy={busy}/></>}
        {isOffice && section === 'assignments' && <>
          {assignCourse && capabilities?.assign && <NativeSection className="ac-panel" aria-label="Schulung zuweisen"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">SCHULUNG ZUWEISEN</NativeP><NativeH2 className="ac-section-title">{assignCourse.content.title}</NativeH2><NativeP className="ac-muted">Fassung {assignCourse.versionNumber} · Jede Person erhält einen eigenen Lernstand.</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setAssignCourseId(null)}>Schließen</NativeButton></NativeDiv><NativeFieldset disabled={busy}><NativeDiv className="ac-inline-fields"><NativeLabel className="ac-field ac-search">Person suchen<NativeInput className="ac-input" type="search" value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder="Name oder Zuordnung…"/></NativeLabel><NativeLabel className="ac-field">Abschluss bis<NativeInput className="ac-input" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></NativeLabel></NativeDiv><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle small" disabled={!readyTargets.length} onClick={() => setSelectedTargets(previous => [...new Set([...previous, ...readyTargets.map(personKey)])].slice(0, 200))}>Sichtbare Personen auswählen</NativeButton><NativeButton type="button" className="ac-button subtle small" disabled={!selectedTargets.length} onClick={() => setSelectedTargets([])}>Auswahl aufheben</NativeButton><NativeSpan className="ac-muted">{selectedTargets.length} von höchstens 200 ausgewählt</NativeSpan></NativeDiv><NativeDiv className="ac-targets">{availableTargets.map(participant => <NativeLabel key={personKey(participant)} className="ac-target-row"><NativeInput type="checkbox" disabled={!participant.portalReady || (selectedTargets.length >= 200 && !selectedTargets.includes(personKey(participant)))} checked={selectedTargets.includes(personKey(participant))} onChange={event => setSelectedTargets(previous => event.target.checked ? [...previous, personKey(participant)] : previous.filter(key => key !== personKey(participant)))}/><NativeSpan><NativeStrong>{participant.name}</NativeStrong><NativeSmall>{ACADEMY_AUDIENCE_LABELS[participant.kind]}{participant.contextLabel ? ` · ${participant.contextLabel}` : ''}</NativeSmall>{!participant.portalReady && <NativeSmall>Portalzugang noch nicht aktiv</NativeSmall>}</NativeSpan></NativeLabel>)}</NativeDiv>{!availableTargets.length && <Empty title="Keine passende Person gefunden">Prüfen Sie die Zielgruppe, die Suche und die vorhandenen Portalzugänge.</Empty>}<NativeP className="ac-muted">Es werden vorhandene Personen und Portalzugänge verwendet. Angehörige erhalten eine eigene Teilnahme, getrennt von der betreuten Person.</NativeP><NativeButton type="button" className="ac-button primary" disabled={!selectedTargets.length || assignCourse.status !== 'published'} onClick={() => void assign()}>Schulung verbindlich zuweisen</NativeButton></NativeFieldset></NativeSection>}
          {!assignCourse && capabilities?.assign && <NativeDiv className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Schulungen zuweisen</NativeH2><NativeP className="ac-muted">Wählen Sie einen veröffentlichten Kurs und anschließend die Personen.</NativeP></NativeDiv><NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => { go('courses'); setCourseStatus('published'); }}>Kurs auswählen</NativeButton></NativeDiv></NativeDiv>}
          {selectedEnrollmentId && <NativeDiv className="ac-panel-header"><NativeH2 className="ac-section-title">Ausgewählte Teilnahme</NativeH2><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setSelectedEnrollmentId(null)}>Alle Zuweisungen</NativeButton></NativeDiv>}{toolbar}<NativeSection className="ac-panel">{filteredEnrollments.length ? <NativeDiv className="ac-list">{filteredEnrollments.map(enrollment => <NativeArticle className="ac-list-row" key={enrollment.id}><NativeDiv className="ac-list-main"><NativeStrong>{enrollment.participant.name}</NativeStrong><NativeSpan>{enrollment.content.title}</NativeSpan><NativeSmall className="ac-muted">{ACADEMY_AUDIENCE_LABELS[enrollment.participant.kind]} · Fassung {enrollment.versionNumber} · {enrollment.dueDate ? `Frist ${dateText(enrollment.dueDate)}` : 'Ohne Frist'}</NativeSmall><Progress value={enrollment.progress} label="Lernfortschritt"/></NativeDiv><NativeDiv className="ac-list-actions"><NativeSpan className="ac-status" data-tone={isAcademyOverdue(enrollment) ? 'attention' : toneForState(enrollment.state)}>{isAcademyOverdue(enrollment) ? 'Überfällig' : ACADEMY_STATE_LABELS[enrollment.state]}</NativeSpan>{enrollment.state === 'submitted' && capabilities?.review && (resolvedReviews[enrollment.id] === undefined || enrollment.revision > resolvedReviews[enrollment.id]!) && <NativeButton type="button" className="ac-button small" disabled={busy} onClick={() => { setReviewId(enrollment.id); setReviewNote(''); setValidUntil(''); setSection('reviews'); }}>Abschluss prüfen</NativeButton>}{!['completed', 'cancelled'].includes(enrollment.state) && capabilities?.assign && <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => { setCancelId(enrollment.id); setCancelNote(''); }}>Zuweisung beenden</NativeButton>}</NativeDiv></NativeArticle>)}</NativeDiv> : <Empty title="Keine passenden Zuweisungen">Neue Schulungen werden aus einem veröffentlichten Kurs zugewiesen. Bereits vorhandene Zuweisungen finden Sie mit der Suche und den Filtern.</Empty>}</NativeSection>
        </>}
        {isOffice && section === 'reviews' && <>{toolbar}
          <NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">ABSCHLÜSSE PRÜFEN</NativeP><NativeH2 className="ac-section-title">Bearbeitung nachvollziehen und freigeben</NativeH2><NativeP className="ac-muted">Eine Freigabe bestätigt den dokumentierten Lernabschluss. Sie erzeugt keine berufliche Qualifikation oder Einsatzfreigabe.</NativeP></NativeDiv></NativeDiv>{!capabilities?.review ? <Empty title="Prüfrecht erforderlich">Für Freigaben und Rückmeldungen benötigen Sie die passende Berechtigung.</Empty> : reviews.length ? <NativeDiv className="ac-list">{reviews.map(enrollment => <NativeArticle className="ac-list-row" key={enrollment.id}><NativeDiv className="ac-list-main"><NativeStrong>{enrollment.participant.name}</NativeStrong><NativeSpan>{enrollment.content.title}</NativeSpan><NativeSmall className="ac-muted">Fassung {enrollment.versionNumber} · Eingereicht {dateText(enrollment.submittedAt)}</NativeSmall></NativeDiv><NativeButton type="button" className="ac-button" disabled={busy} onClick={() => { setReviewId(enrollment.id); setReviewNote(''); setValidUntil(''); }}>Prüfen</NativeButton></NativeArticle>)}</NativeDiv> : <Empty title="Keine Abschlüsse zur Prüfung">Vollständig bearbeitete und eingereichte Schulungen erscheinen hier.</Empty>}</NativeSection>
          {reviewEnrollment && reviewEnrollment.state === 'submitted' && capabilities?.review && <NativeSection className="ac-panel" aria-label="Abschluss prüfen"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">{reviewEnrollment.participant.name}</NativeH2><NativeP>{reviewEnrollment.content.title} · Fassung {reviewEnrollment.versionNumber}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setReviewId(null)}>Schließen</NativeButton></NativeDiv><NativeDiv className="ac-list">{reviewEnrollment.content.lessons.map(lesson => { const attempts = reviewEnrollment.attempts.filter(attempt => attempt.lessonId === lesson.id); const latest = [...attempts].sort((a, b) => b.attempt - a.attempt)[0]; return <NativeWorkspaceStyleScope css={[academyStyles]}>{<NativeDiv className="ac-list-row" key={lesson.id}><NativeDiv className="ac-list-main"><NativeStrong>{lesson.title}</NativeStrong><NativeSpan className="ac-muted">{lesson.kind === 'quiz' ? latest ? `${latest.score} % · ${attempts.length} ${attempts.length === 1 ? 'Versuch' : 'Versuche'}` : 'Kein Wissenscheck-Ergebnis' : 'Bearbeitung durch die lernende Person bestätigt'}</NativeSpan></NativeDiv><NativeSpan className="ac-status" data-tone={reviewEnrollment.completedLessonIds.includes(lesson.id) ? 'good' : 'attention'}>{reviewEnrollment.completedLessonIds.includes(lesson.id) ? 'Bearbeitet' : 'Offen'}</NativeSpan></NativeDiv>}</NativeWorkspaceStyleScope>; })}</NativeDiv><NativeFieldset className="ac-review-form" disabled={busy}><NativeLabel className="ac-field">Rückmeldung<NativeTextarea className="ac-input ac-textarea" rows={4} maxLength={4000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="Bei Rückgabe bitte konkret beschreiben, was überarbeitet werden soll."/></NativeLabel><NativeLabel className="ac-field">Nachweis gültig bis (optional)<NativeInput className="ac-input" type="date" min={new Date().toLocaleDateString('sv-SE')} value={validUntil} onChange={event => setValidUntil(event.target.value)}/></NativeLabel><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button" disabled={reviewNote.trim().length < 3} onClick={() => void review('return')}>Zur Überarbeitung zurückgeben</NativeButton><NativeButton type="button" className="ac-button primary" onClick={() => void review('approve')}>Abschluss freigeben & Nachweis erstellen</NativeButton></NativeDiv></NativeFieldset></NativeSection>}
        </>}
        {section === 'certificates' && <>{toolbar}<NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">{isOffice ? 'Teilnahme- und Lernnachweise' : 'Ihre Nachweise'}</NativeH2><NativeP className="ac-muted">Nachweise beziehen sich auf die bestätigte Kursfassung und den geprüften Lernabschluss.</NativeP></NativeDiv>{selectedEnrollmentId && <NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setSelectedEnrollmentId(null)}>Alle Nachweise</NativeButton>}</NativeDiv>{filteredCertificates.length ? <NativeDiv className="ac-list">{filteredCertificates.map(certificate => { const revoked = Boolean(certificate.revokedAt || revokedIds.includes(certificate.id)); const expired = Boolean(certificate.validUntil && certificate.validUntil.slice(0, 10) < new Date().toLocaleDateString('sv-SE')); return <NativeWorkspaceStyleScope css={[academyStyles]}>{<NativeArticle className="ac-list-row" key={certificate.id}><NativeDiv className="ac-list-main"><NativeStrong>{certificate.courseTitle}</NativeStrong><NativeSpan>{certificate.participantName}</NativeSpan><NativeSmall className="ac-muted">{certificate.number} · Ausgestellt {dateText(certificate.issuedAt)} · {certificate.validUntil ? `Gültig bis ${dateText(certificate.validUntil)}` : 'Ohne Ablaufdatum'}</NativeSmall>{certificate.revokedReason && <NativeSmall>{certificate.revokedReason}</NativeSmall>}</NativeDiv><NativeDiv className="ac-list-actions">{isOffice && capabilities?.assign && <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => { go('planning'); setSearch(certificate.participantName); }}>Im Schulungsplan ansehen</NativeButton>}<NativeSpan className="ac-status" data-tone={revoked ? 'danger' : expired ? 'attention' : 'good'}>{revoked ? 'Zurückgenommen' : expired ? 'Abgelaufen' : 'Bestätigt'}</NativeSpan><NativeButton type="button" className="ac-button" disabled={busy || Boolean(downloadingId) || revoked} onClick={() => void download(certificate)}>{downloadingId === certificate.id ? 'Wird geöffnet…' : 'PDF öffnen'}</NativeButton>{isOffice && capabilities?.review && !revoked && <NativeButton type="button" className="ac-button subtle small" disabled={busy} onClick={() => { setRevokeId(certificate.id); setRevokeNote(''); }}>Nachweis zurücknehmen</NativeButton>}</NativeDiv></NativeArticle>}</NativeWorkspaceStyleScope>; })}</NativeDiv> : <Empty title="Noch keine passenden Nachweise">Nach bestätigter Freigabe einer abgeschlossenen Schulung steht der persönliche Nachweis hier bereit.</Empty>}</NativeSection></>}
        {section === 'library' && <>{toolbar}<NativeSection className="ac-panel"><NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Wissen griffbereit</NativeH2><NativeP className="ac-muted">{isOffice ? 'Materialien aus veröffentlichten Kursen.' : 'Materialien aus Ihren zugewiesenen Schulungen.'} Externe Inhalte öffnen sich erst nach Ihrer Auswahl.</NativeP></NativeDiv></NativeDiv>{filteredMaterials.length ? <NativeDiv className="ac-card-grid">{filteredMaterials.map(({ lesson, courseTitle, key }) => <NativeArticle className="ac-panel" key={key}><NativeP className="ac-eyebrow">{lesson.kind === 'text' ? 'LESETEXT' : lesson.kind === 'video' ? 'VIDEO' : 'DOKUMENT'}</NativeP><NativeH3>{lesson.title}</NativeH3><NativeP className="ac-muted">{courseTitle}</NativeP>{lesson.body && <NativeDetails><NativeSummary>Text lesen</NativeSummary><NativeDiv className="ac-learning-body">{lesson.body}</NativeDiv></NativeDetails>}{lesson.kind !== 'text' && (academySafeResourceUrl(lesson.url) ? <NativeA className="ac-button" href={academySafeResourceUrl(lesson.url)!} target="_blank" rel="noopener noreferrer">Material öffnen ↗</NativeA> : <NativeP className="ac-muted">Kein verwendbarer Link hinterlegt.</NativeP>)}</NativeArticle>)}</NativeDiv> : <Empty title="Noch keine passenden Materialien">Materialien erscheinen zusammen mit den für Sie verfügbaren Schulungen.</Empty>}</NativeSection></>}
        {!isOffice && !['certificates', 'library', 'planning'].includes(section) && <>{selectedEnrollment ? <AcademyLearningPlayer key={selectedEnrollment.id} enrollment={selectedEnrollment} certificate={certificates.find(certificate => certificate.enrollmentId === selectedEnrollment.id) ?? null} busy={busy || !capabilities?.learn} onCommand={onCommand} onDownloadCertificate={onDownloadCertificate} onBack={() => { setSelectedEnrollmentId(null); setCourseRouteDismissed(true); }}/> : <>{toolbar}{filteredEnrollments.length ? <NativeDiv className="ac-card-grid">{filteredEnrollments.map(enrollment => <EnrollmentCard key={enrollment.id} enrollment={enrollment} busy={busy} onOpen={() => setSelectedEnrollmentId(enrollment.id)}/>)}</NativeDiv> : <NativeSection className="ac-panel"><Empty title={enrollments.length ? 'Keine passenden Schulungen' : 'Ihr Lernbereich ist bereit'}>{enrollments.length ? 'Ändern Sie die Suche oder den Lernstandfilter.' : 'Sobald Ihnen eine Schulung zugewiesen wird, erscheint sie hier mit Frist und Lernmaterialien.'}</Empty></NativeSection>}</>}</>}
      </>}
      {archiveCourse && <NativeSection className="ac-panel" aria-label="Kurs archivieren"><NativeH2 className="ac-section-title">„{archiveCourse.content.title}“ archivieren?</NativeH2><NativeP>Es sind anschließend keine neuen Zuweisungen möglich. Vorhandene Teilnahmen und Nachweise bleiben erhalten.</NativeP><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button danger" disabled={busy || !capabilities?.manageCourses} onClick={() => void archive()}>Kurs archivieren</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setArchiveId(null)}>Abbrechen</NativeButton></NativeDiv></NativeSection>}
      {cancelEnrollment && <NativeSection className="ac-panel" aria-label="Zuweisung beenden"><NativeH2 className="ac-section-title">Zuweisung beenden</NativeH2><NativeP>{cancelEnrollment.participant.name} · {cancelEnrollment.content.title}</NativeP><NativeLabel className="ac-field">Begründung<NativeTextarea className="ac-input ac-textarea" disabled={busy} rows={3} maxLength={4000} value={cancelNote} onChange={event => setCancelNote(event.target.value)}/></NativeLabel><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button danger" disabled={busy || cancelNote.trim().length < 3 || !capabilities?.assign} onClick={() => void cancel()}>Zuweisung beenden</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setCancelId(null)}>Abbrechen</NativeButton></NativeDiv></NativeSection>}
      {certificateToRevoke && <NativeSection className="ac-panel" aria-label="Nachweis zurücknehmen"><NativeH2 className="ac-section-title">Nachweis zurücknehmen</NativeH2><NativeP>{certificateToRevoke.participantName} · {certificateToRevoke.courseTitle}</NativeP><NativeP className="ac-muted">Der Nachweis bleibt mit der Begründung als zurückgenommen dokumentiert.</NativeP><NativeLabel className="ac-field">Begründung<NativeTextarea className="ac-input ac-textarea" rows={3} maxLength={4000} disabled={busy} value={revokeNote} onChange={event => setRevokeNote(event.target.value)}/></NativeLabel><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button danger" disabled={busy || revokeNote.trim().length < 3 || !capabilities?.review} onClick={() => void revoke()}>Nachweis zurücknehmen</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setRevokeId(null)}>Abbrechen</NativeButton></NativeDiv></NativeSection>}
    </>}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
