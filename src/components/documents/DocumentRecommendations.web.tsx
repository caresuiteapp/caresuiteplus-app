import { useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { documentCatalogRoute, getDocumentRecommendations } from '@/lib/documents/documentRecommendations';
import type { DocumentRecommendationsProps } from './DocumentRecommendations';

export function DocumentRecommendations(props: DocumentRecommendationsProps) {
  const router = useRouter();
  const { can } = usePermissions();
  if (!can('office.documents.view')) return null;
  const canCreate = can('documents.create');
  const recommendations = canCreate ? getDocumentRecommendations(props).filter((entry) => (entry.target !== 'client' || can('office.clients.view') && can('office.clients.view_sensitive')) && (entry.target !== 'employee' || can('office.employees.view')) && (!entry.clinicalReviewRequired || can('office.clients.view_sensitive'))) : [];
  const scoped = Boolean(props.clientId || props.employeeId);
  const open = (href: string) => router.push(href as never);
  const Surface = props.compact ? 'details' : 'section';
  return <Surface className={`cs-doc-rec${props.compact ? ' compact' : ''}${props.widget ? ' widget' : ''}`} aria-label={props.title ?? 'Dokumentvorschläge'}>
    {props.compact ? <summary className="cs-doc-rec-summary"><span aria-hidden="true">▤</span><strong>{props.title ?? 'Dokumentvorschläge'}</strong><span>{recommendations.length ? `${recommendations.length} Vorschläge` : 'Katalog und Fassungen'}</span></summary> : null}
    <style>{documentRecommendationCss}</style>
    <div className="cs-doc-rec-content">
    <div className="cs-doc-rec-heading"><div><span className="cs-doc-rec-label">OFFICE · DOKUMENTENKATALOG</span><h3>{props.title ?? (props.widget ? 'Zentrale Dokumente' : 'Passende Dokumente für diesen Vorgang')}</h3><p>{scoped ? 'Die ausgewählte Akte wird beim Öffnen übernommen.' : 'Vorlage auswählen und mit gespeicherten Unternehmens- und Aktenangaben ergänzen.'}</p></div><span className="cs-doc-rec-count">450 Vorlagen · 25 Bereiche</span></div>
    {recommendations.length ? <div className="cs-doc-rec-grid">{recommendations.map((entry) => <button type="button" key={entry.key} onClick={() => open(entry.href)} className="cs-doc-rec-card"><span className="cs-doc-rec-icon" aria-hidden="true">▤</span><span><strong>{entry.title}</strong><small>{entry.reason}</small><em>{entry.sourceMode === 'original' ? 'Original mit Begleitblatt' : 'Bearbeitbaren Entwurf öffnen'} <span aria-hidden="true">→</span></em></span></button>)}</div> : null}
    <div className="cs-doc-rec-actions"><button type="button" onClick={() => open(documentCatalogRoute(props))}>Gesamten Katalog öffnen <span aria-hidden="true">↗</span></button><button type="button" onClick={() => open(documentCatalogRoute({ ...props, tab: 'records' }))}>{scoped ? 'Gespeicherte Dokumente dieser Akte' : 'Gespeicherte Dokumentfassungen'}</button></div>
    </div>
  </Surface>;
}

export const documentRecommendationCss = `
.cs-doc-rec{container-type:inline-size;width:100%;min-width:0;box-sizing:border-box;margin:16px 0;padding:20px;border:1px solid rgba(125,169,218,.24);border-radius:18px;background:linear-gradient(115deg,rgba(15,33,59,.94),rgba(20,47,76,.84));color:#f0f6ff;font-family:CenturyGothic,Arial,sans-serif}
.cs-doc-rec *{box-sizing:border-box}.cs-doc-rec-heading{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.cs-doc-rec-label{font-size:10px;letter-spacing:1px;color:#8dcaff;line-height:1.6}.cs-doc-rec h3{margin:5px 0;font-size:17px;line-height:1.4}.cs-doc-rec p{margin:0;font-size:12px;line-height:1.6;color:#c1d2e6}.cs-doc-rec-count{font-size:11px;line-height:1.5;color:#b9d9f7;border:1px solid #3c5f81;border-radius:7px;padding:6px 9px}.cs-doc-rec-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.cs-doc-rec button{font:inherit;cursor:pointer;color:inherit;min-height:44px;white-space:normal;overflow-wrap:anywhere}.cs-doc-rec-card{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:14px;border:1px solid #355578;border-radius:12px;background:rgba(40,67,99,.4);width:100%;min-width:0}.cs-doc-rec-card:hover{border-color:#82c4ff;background:rgba(49,91,132,.45)}.cs-doc-rec-card>span:last-child{min-width:0}.cs-doc-rec-icon{font-size:20px;color:#8bcbff;flex-shrink:0}.cs-doc-rec-card strong{display:block;font-size:12px;line-height:1.5}.cs-doc-rec-card small{display:block;color:#c1d2e6;font-size:11px;line-height:1.6;margin-top:6px}.cs-doc-rec-card em{display:block;font-size:10px;font-style:normal;color:#9dd1ff;line-height:1.6;margin-top:10px}.cs-doc-rec-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}.cs-doc-rec-actions button{background:transparent;border:0;padding:8px 0;color:#a5d6ff;font-size:12px;text-align:left}.cs-doc-rec button:focus-visible{outline:3px solid #8bcbff;outline-offset:3px}.cs-doc-rec.compact{padding:16px}.cs-doc-rec.widget{border-color:#5680ad}
.cs-doc-rec-summary{display:flex;align-items:center;gap:10px;list-style:none;min-height:28px;cursor:pointer;font-size:12px;line-height:1.6;flex-wrap:wrap}.cs-doc-rec-summary::-webkit-details-marker{display:none}.cs-doc-rec-summary>span:last-child{font-size:11px;color:#b6d6f4;margin-left:auto}.cs-doc-rec-summary::after{content:'+';color:#a5d6ff;font-size:20px;line-height:1}.cs-doc-rec[open]>.cs-doc-rec-summary::after{content:'−'}.cs-doc-rec[open]>.cs-doc-rec-content{padding-top:18px}.cs-doc-rec-summary:focus-visible{outline:3px solid #8bcbff;outline-offset:4px}
@container(max-width:760px){.cs-doc-rec-grid{grid-template-columns:1fr}.cs-doc-rec-card{padding:12px}.cs-doc-rec-count{max-width:100%}}
@media(max-width:600px){.cs-doc-rec-grid{grid-template-columns:1fr}.cs-doc-rec{padding:16px}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
