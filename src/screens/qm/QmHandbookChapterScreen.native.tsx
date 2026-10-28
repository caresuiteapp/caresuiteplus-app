// Generated native presentation from src/screens/qm/QmHandbookChapterScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeStyle,NativeArticle,NativeHeader,NativeDiv,NativeSpan,NativeH2,NativeStrong,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
import { QmDocumentBadge, QmDocumentRefresh, QmDocumentState } from "../../components/qm/QmDocumentUi.native.tsx";
import { qmDocumentWorkspaceCss } from "../../components/qm/qmDocumentWorkspaceCss.native.ts";
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { usePermissions } from '@/hooks/usePermissions';
import { useQmTenantQuery } from "../../hooks/qm/useQmBase.native.ts";
import { fetchQmChapter } from '@/lib/qm/qmHandbookService';
import { qmDisplayDate } from "../../lib/qm/qmDocumentWorkspace.native.ts";
export function QmHandbookChapterScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const id = typeof params.id === 'string' ? params.id : '';
    const router = useRouter();
    const { can, check } = usePermissions();
    const query = useQmTenantQuery((tenant, role) => id ? fetchQmChapter(tenant, id, role) : Promise.resolve({ ok: false as const, error: 'Das Kapitel ist nicht eindeutig angegeben.' }), [id]);
    const chapter = query.data;
    const busy = query.loading || query.refreshing;
    const back = <NativeButton className="qm-button" type="button" onClick={() => router.push('/business/office/qm/handbook' as never)}><CatalogIcon kind="back"/>Zum Handbuch</NativeButton>;
    return <NativeWorkspaceStyleScope css={[qmDocumentWorkspaceCss, qmDocumentWorkspaceCss]}>{<QmSectionShell title={can('qm.view') && chapter ? chapter.title : 'Handbuch-Kapitel'} subtitle="Gespeicherten Kapiteltext und Fassungsstand lesen." actions={can('qm.view') ? <>{back}<QmDocumentRefresh busy={busy} refresh={query.refresh}/></> : undefined}>
    <NativeStyle>{qmDocumentWorkspaceCss}</NativeStyle>
    {!can('qm.view') ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für dieses Kapitel fehlt die Berechtigung.'}/> : query.loading && !chapter ? <QmDocumentState title="Kapitel wird geladen" message="Der gespeicherte Kapiteltext wird abgerufen …"/> : query.error && !chapter ? <QmDocumentState title="Kapitel nicht verfügbar" message={query.error} error>{back}<QmDocumentRefresh busy={busy} refresh={query.refresh}/></QmDocumentState> : chapter ? <>
      {query.refreshError ? <QmDocumentState title="Aktualisierung fehlgeschlagen" message={`${query.refreshError} Der zuletzt geladene Stand bleibt sichtbar.`} error/> : null}
      <NativeArticle className="qm-panel"><NativeHeader className="qm-panel-head"><NativeDiv><NativeSpan className="qm-eyebrow">Gespeicherter Stand</NativeSpan><NativeH2>Version {chapter.version}</NativeH2></NativeDiv><QmDocumentBadge status={chapter.status}/></NativeHeader><NativeDiv className="qmd-meta"><NativeSpan>Geändert: <NativeStrong>{qmDisplayDate(chapter.updatedAt)}</NativeStrong></NativeSpan><NativeSpan>Letzte Überprüfung: <NativeStrong>{qmDisplayDate(chapter.lastReviewedAt)}</NativeStrong></NativeSpan></NativeDiv><NativeDiv className="qmd-paper">{chapter.content.trim() ? <NativeP className="qmd-paper-content">{chapter.content}</NativeP> : <QmDocumentState title="Kein Kapiteltext hinterlegt" message="Für dieses Kapitel wurde noch kein Text gespeichert."/>}</NativeDiv></NativeArticle>
    </> : <QmDocumentState title="Kapitel nicht gefunden" message="Für diese Auswahl wurde kein Kapitel geliefert.">{back}</QmDocumentState>}
  </QmSectionShell>}</NativeWorkspaceStyleScope>;
}
