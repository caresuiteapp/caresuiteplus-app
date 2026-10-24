// Generated native presentation from src/screens/documents/CsDocumentRequestDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeDiv,NativeStyle,NativeP,NativeDl,NativeDt,NativeDd,NativeSection,NativeH3,NativeStrong,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { resolvePortalDocumentSignerRole } from '@/lib/portal/portalDocumentSignatureHelpers';
import { useClientSignatureAttention } from "../../components/portal/ClientSignatureAttentionProvider.native.tsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from "../../hooks/useFlowRouter.ts";
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { DocumentsWorkspaceShell } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { OfficeSignatureReview } from "../../components/office/documentSignatures/OfficeSignatureReview.native.tsx";
import { SIGNER_LABELS, signatureDate } from "../../components/office/documentSignatures/signatureWorkspaceModel.native.ts";
import { signatureWorkspaceCss } from "../../components/office/documentSignatures/signatureWorkspaceCss.native.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { CareSignatureModal } from "../../components/inputs/CareSignatureModal.native.tsx";
import { SignatureDisplay } from '@/components/signatures/SignatureDisplay';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, SectionPanel, InfoBanner, SuccessState, } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { PORTAL_LIGHT_LINK_ORANGE } from '@/design/tokens/auroraGlass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { EMPLOYEE_TEMPLATE_SIGNING_RELEASE_GATE, fetchCsDocumentRequestDetail, fetchPortalCsDocumentRequestDetail, markCsDocumentRequestOpened, signCsDocumentRequest, } from '@/lib/documents/csTemplates';
import { resolveCsDocumentRequestStatusLabel } from '@/types/documents/csTemplateDatabase';
import type { CsSignerRole } from '@/types/documents/csTemplateDatabase';
import { typography, spacing } from '@/theme';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { usePortalActor } from '@/hooks/usePortalActor';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
type PortalMode = 'office' | 'employee' | 'client';
type Props = {
    mode: PortalMode;
    signerRole: CsSignerRole;
    signerNameDefault?: string;
};
function RequestDetailShell({ mode, title, subtitle, canSign, onSign, children, }: {
    mode: PortalMode;
    title: string;
    subtitle?: string;
    accent: string;
    canSign?: boolean;
    onSign?: () => void;
    children: ReactNode;
}) {
    if (mode === 'office') {
        return (<DocumentsWorkspaceShell active="signatures" title={title} description={subtitle} actions={canSign && onSign ? <NativeButton className="dw-button dw-button--primary" onClick={onSign}>Unterschreiben</NativeButton> : undefined}>
        {children}
      </DocumentsWorkspaceShell>);
    }
    return (<PortalTabScreen title={title} subtitle={subtitle} actionsSlot={canSign && onSign ? <PremiumButton title="Jetzt unterschreiben" onPress={onSign}/> : undefined}>
      {children}
    </PortalTabScreen>);
}
export function CsDocumentRequestDetailScreen({ ...props }: Props) {
    const { source } = useLocalSearchParams<{
        source?: string;
    }>();
    if (props.mode === 'office' && source === 'portal')
        return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss]}>{<OfficeSignatureReview />}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss]}>{<TemplateRequestDetail {...props}/>}</NativeWorkspaceStyleScope>;
}
function TemplateRequestDetail({ mode, signerRole, signerNameDefault, }: Props) {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const router = useRouter();
    const attention = useClientSignatureAttention();
    const signing = useRef(false);
    const reviewedDocumentVersion = useRef<string | undefined>(undefined);
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const permissions = usePermissions();
    const portalActor = usePortalActor();
    const text = useAuroraAdaptiveText();
    const isPortal = mode !== 'office';
    const [signModal, setSignModal] = useState(false);
    const [working, setWorking] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [signSuccess, setSignSuccess] = useState(false);
    const autoOpenedRequestRef = useRef<string | null>(null);
    const query = useAsyncQuery(async () => {
        if (!tenantId || !id)
            return { ok: false as const, error: 'Dokument nicht gefunden.' };
        if (mode === 'office') {
            return fetchCsDocumentRequestDetail(tenantId, id, profile?.roleKey);
        }
        return fetchPortalCsDocumentRequestDetail({
            tenantId,
            requestId: id,
            roleKey: portalActor.roleKey,
            employeeId: portalActor.employeeId,
            clientId: portalActor.clientId,
        });
    }, [tenantId, id, profile?.roleKey, mode, portalActor.roleKey, portalActor.employeeId, portalActor.clientId], { enabled: !!tenantId && !!id && (isPortal ? portalActor.isLinkedReady : permissions.can('office.documents.view')), queryKey: JSON.stringify([tenantId, id, mode, profile?.id, portalActor.actorId, portalActor.roleKey, portalActor.employeeId, portalActor.clientId]) });
    const item = query.data;
    const effectiveSignerRole = resolvePortalDocumentSignerRole({ mode, roleKey: portalActor.roleKey, pendingRoles: item?.pendingSignatureRoles ?? [], defaultRole: signerRole });
    const employeeSigningBlocked = mode === 'employee' && portalActor.roleKey === 'employee_portal';
    const canSign = !employeeSigningBlocked
        && (mode !== 'office' || (permissions.can('office.documents.signatures.manage') && !permissions.isReadOnly))
        && item
        && item.pendingSignatureRoles.includes(effectiveSignerRole)
        && ['sent', 'opened', 'partially_signed'].includes(item.status);
    const signedEntries = item?.signatures.filter((sig) => sig.status === 'signed') ?? [];
    const statusLabel = item
        ? resolveCsDocumentRequestStatusLabel(item.status, isPortal)
        : 'Dokument';
    const styles = useMemo(() => StyleSheet.create({
        meta: { ...typography.caption, color: text.muted, marginBottom: spacing.sm },
        historyRow: { gap: spacing.sm, marginTop: spacing.sm },
        backLink: { marginTop: spacing.md, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    }), [text]);
    const handleOpen = async () => {
        if (!tenantId || !id || item?.status !== 'sent')
            return;
        await markCsDocumentRequestOpened(tenantId, id);
        await query.refresh();
    };
    useEffect(() => {
        if (!isPortal || item?.status !== 'sent' || !id || autoOpenedRequestRef.current === id)
            return;
        autoOpenedRequestRef.current = id;
        void handleOpen();
        // The request id/status deliberately owns this one-time portal acknowledgement.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isPortal, item?.status]);
    const handleSign = async (dataUrl: string) => {
        if (!tenantId || !id || signing.current || !canSign)
            return;
        signing.current = true;
        setWorking(true);
        try {
            setActionError(null);
            const result = await signCsDocumentRequest({
                tenantId,
                requestId: id,
                signerRole: effectiveSignerRole,
                signerName: signerNameDefault ?? profile?.displayName ?? 'Unterzeichner:in',
                signatureDataUrl: dataUrl,
                expectedUpdatedAt: reviewedDocumentVersion.current,
                anchorToken: `${effectiveSignerRole}_signature`,
                portalActor: isPortal && portalActor.roleKey
                    ? {
                        roleKey: portalActor.roleKey,
                        employeeId: portalActor.employeeId,
                        clientId: portalActor.clientId,
                    }
                    : undefined,
            });
            if (!result.ok) {
                setActionError(isPortal
                    ? toPortalUserFacingError(result.error, 'Ihre Unterschrift konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.')
                    : result.error);
                return;
            }
            setSignModal(false);
            setSignSuccess(true);
        }
        catch {
            setActionError("Ihre Unterschrift konnte nicht bestätigt werden. Bitte prüfen Sie das Dokument und versuchen Sie es erneut.");
        }
        finally {
            await Promise.allSettled([query.refresh(), attention.refresh()]);
            signing.current = false;
            setWorking(false);
        }
    };
    const accent = mode === 'office' ? moduleColor('office') : moduleColor('assist');
    if (mode === 'office' && !permissions.can('office.documents.view')) {
        return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss]}>{<DocumentsWorkspaceShell active="signatures" title="Unterschriftsdokument"><NativeDiv className="dw-empty">Sie haben keine Berechtigung für dieses Dokument.</NativeDiv></DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
    }
    if (isPortal && !portalActor.isLinkedReady) {
        const isResolving = portalActor.isResolvingClientLink || portalActor.isResolvingEmployeeLink;
        return (<RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        {isResolving ? (<LoadingState message="Ihr Portalprofil wird sicher verknüpft…"/>) : (<ErrorState message="Ihr Portalprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an."/>)}
      </RequestDetailShell>);
    }
    if (query.loading && !item) {
        return (<RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        <LoadingState message="Dokument wird geladen…"/>
      </RequestDetailShell>);
    }
    if (query.error || !item) {
        return (<RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        <ErrorState message={isPortal
                ? toPortalUserFacingError(query.error, 'Dieses Dokument kann gerade nicht angezeigt werden. Bitte versuchen Sie es erneut.')
                : query.error ?? 'Dieses Dokument kann gerade nicht angezeigt werden.'} onRetry={query.refresh}/>
      </RequestDetailShell>);
    }
    if (mode === 'office') {
        return <NativeWorkspaceStyleScope css={[signatureWorkspaceCss, signatureWorkspaceCss]}>{<>
      <DocumentsWorkspaceShell active="signatures" title={item.title} description={statusLabel} back={{ label: 'Zurück zu Unterschriften', onClick: () => router.back() }} actions={<><NativeButton className="dw-button" onClick={() => void query.refresh()}>Aktualisieren</NativeButton>{canSign ? <NativeButton className="dw-button dw-button--primary" onClick={() => { reviewedDocumentVersion.current = item.updatedAt; setSignModal(true); }}>Unterschreiben</NativeButton> : null}</>}>
        <NativeStyle>{signatureWorkspaceCss}</NativeStyle>
        <NativeDiv className="ds-form">
          {permissions.isReadOnly ? <NativeP className="ds-notice">Lesemodus: Dokument und Unterschriften können angesehen werden.</NativeP> : null}
          {query.refreshError ? <NativeP role="alert" className="ds-notice ds-notice--error">Der aktuelle Dokumentstatus konnte nicht geladen werden. {query.refreshError}</NativeP> : null}
          <NativeDl className="ds-review"><NativeDiv><NativeDt>Status</NativeDt><NativeDd>{statusLabel}</NativeDd></NativeDiv><NativeDiv><NativeDt>Fälligkeit</NativeDt><NativeDd>{signatureDate(item.dueDate)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Empfängergruppe</NativeDt><NativeDd>{SIGNER_LABELS[item.recipientScope] ?? 'Dokumentempfänger'}</NativeDd></NativeDiv></NativeDl>
          {item.pendingSignatureRoles.length ? <NativeP className="ds-notice">Ausstehende Unterschriften: {item.pendingSignatureRoles.map((role) => SIGNER_LABELS[role]).join(', ')}{item.requiredBeforeService ? '. Vor dem zugehörigen Einsatz erforderlich.' : ''}</NativeP> : null}
          {signSuccess ? <NativeP role="status" className="ds-notice ds-notice--success">Die Unterschrift wurde gespeichert.{item.status === 'completed' || item.status === 'archived' ? ' Das Dokument ist vollständig unterschrieben.' : ''}</NativeP> : null}
          {actionError ? <NativeP role="alert" className="ds-notice ds-notice--error">{actionError}</NativeP> : null}
          <NativeSection><NativeH3>Dokumentinhalt</NativeH3>{item.renderedHtml ? <DocumentHtmlPreview title={item.title} previewHtml={item.renderedHtml}/> : <NativeP className="ds-muted">Für dieses Dokument liegt keine Vorschau vor.</NativeP>}</NativeSection>
          <NativeSection><NativeH3>Gespeicherte Unterschriften</NativeH3>{signedEntries.length ? signedEntries.map((signature) => <NativeDiv key={signature.id}><NativeStrong>{signature.signerName ?? SIGNER_LABELS[signature.signerRole]}</NativeStrong><NativeP className="ds-muted">{SIGNER_LABELS[signature.signerRole]} · {signature.signedAt ? new Date(signature.signedAt).toLocaleString('de-DE') : 'Zeitpunkt nicht verfügbar'}</NativeP></NativeDiv>) : <NativeP className="ds-muted">Noch keine Unterschrift gespeichert.</NativeP>}</NativeSection>
        </NativeDiv>
      </DocumentsWorkspaceShell>
      <CareSignatureModal statusMessage={actionError} visible={signModal} label="Unterschrift bestätigen" onConfirm={(dataUrl) => void handleSign(dataUrl)} onClose={() => { if (!working)
            setSignModal(false); }} disabled={working}/>
    </>}</NativeWorkspaceStyleScope>;
    }
    return (<>
      <RequestDetailShell mode={mode} title={item.title} subtitle={statusLabel} accent={accent} canSign={Boolean(canSign)} onSign={() => { reviewedDocumentVersion.current = item.updatedAt; setSignModal(true); }}>
        {employeeSigningBlocked ? <InfoBanner variant="warning" message={EMPLOYEE_TEMPLATE_SIGNING_RELEASE_GATE}/> : null}
        {isPortal && canSign ? (<ClientPortalGuide compact title="Bitte prüfen und unterschreiben" message="Lesen Sie das Dokument vollständig. Danach können Sie oben auf „Jetzt unterschreiben“ tippen und direkt mit Finger, Stift oder Maus unterschreiben."/>) : null}
        <Text style={styles.meta}>
          Fällig {item.dueDate ? new Date(item.dueDate).toLocaleDateString('de-DE') : '—'}
          {item.requiredBeforeService ? ' · Pflicht vor Einsatz' : ''}
        </Text>
        {item.pendingSignatureRoles.length > 0 ? (<PremiumBadge label={isPortal ? (canSign ? 'Ihre Unterschrift fehlt noch' : 'Weitere Unterschriften stehen aus') : `Offene Unterschrift: ${item.pendingSignatureRoles.map((role) => SIGNER_LABELS[role]).join(', ')}`} variant="orange"/>) : null}
        {signSuccess ? (<SuccessState message={item.status === 'completed' || item.status === 'archived'
                ? 'Unterschrift gespeichert. Das Dokument ist vollständig unterschrieben.'
                : 'Unterschrift gespeichert. Weitere Unterschriften können noch ausstehen.'}/>) : null}
        {actionError ? <InfoBanner variant="danger" message={actionError}/> : null}
        <SectionPanel title="Dokument prüfen" subtitle="Bitte lesen Sie den Inhalt vollständig, bevor Sie unterschreiben.">
          {item.renderedHtml ? (<DocumentHtmlPreview title={item.title} previewHtml={item.renderedHtml}/>) : (<EmptyState title="Keine Vorschau" message="Für dieses Dokument liegt noch keine gerenderte Ansicht vor."/>)}
        </SectionPanel>

        {signedEntries.length > 0 ? (<SectionPanel title="Historie" subtitle="Gespeicherte Unterschriften">
            <View style={styles.historyRow}>
              {signedEntries.map((sig) => (<SignatureDisplay key={sig.id} label={isPortal ? 'Gespeicherte Unterschrift' : `Unterschrift (${SIGNER_LABELS[sig.signerRole]})`} signerName={sig.signerName} signedAt={sig.signedAt} compact/>))}
            </View>
          </SectionPanel>) : null}

        {isPortal && (signSuccess || item.status === 'completed' || item.status === 'archived') ? (<Pressable onPress={() => mode === 'client' ? router.replace('/portal/client/documents/signatures' as never) : router.back()} style={styles.backLink} accessibilityRole="button">
            <Text style={{ color: PORTAL_LIGHT_LINK_ORANGE, fontWeight: '700' }}>Zurück zur Liste</Text>
          </Pressable>) : null}
      </RequestDetailShell>

      <CareSignatureModal statusMessage={actionError} visible={signModal} label="Unterschrift bestätigen" onConfirm={(dataUrl) => void handleSign(dataUrl)} onClose={() => setSignModal(false)} disabled={working}/>
    </>);
}
