// Generated native presentation from src/components/office/assistCatalog/AssistCatalogMultiSelect.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeH4,NativeP,NativeButton,NativeSpan,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useId } from 'react';
import { useAssistCatalogItems } from '@/hooks/assistCatalog/useAssistCatalog';
import type { CatalogItem } from '@/types/assistCatalog';
type Props = {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
    error?: string;
    catalogKey?: string;
    items?: CatalogItem[];
    loading?: boolean;
};
function Choices({ label, values, onChange, items = [], loading, error, retry }: Props & {
    retry?: () => void;
}) {
    const id = useId();
    return <NativeWorkspaceStyleScope css={[`
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `,
        `
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `]}>{<NativeDiv className="cs-assist-catalog" aria-labelledby={id}>
    <NativeStyle>{`
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `}</NativeStyle>
    <NativeH4 id={id}>{label}</NativeH4>
    {loading ? <NativeP className="cs-assist-catalog-status" role="status">Leistungen werden geladen …</NativeP> : null}
    {error ? <NativeP className="cs-assist-catalog-status cs-assist-catalog-error" role="alert">{error}{retry ? <NativeButton type="button" onClick={retry}>Erneut laden</NativeButton> : null}</NativeP> : null}
    {!loading && !error && !items.length ? <NativeP className="cs-assist-catalog-status">Keine weiteren Leistungen hinterlegt.</NativeP> : null}
    <NativeDiv className="cs-assist-catalog-choices">{items.map(item => {
            const selected = values.includes(item.itemKey);
            return <NativeWorkspaceStyleScope key={item.id} css={[`
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `]}>{<NativeButton type="button" key={item.id} aria-pressed={selected} onClick={() => onChange(selected ? values.filter(value => value !== item.itemKey) : [...values, item.itemKey])}>
        <NativeSpan aria-hidden="true">{selected ? '✓' : '+'}</NativeSpan><NativeSpan>{item.label}</NativeSpan>
      </NativeButton>}</NativeWorkspaceStyleScope>;
        })}</NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function FromCatalog({ catalogKey, ...props }: Props & {
    catalogKey: string;
}) {
    const { items, loading, error, reload } = useAssistCatalogItems(catalogKey);
    return <NativeWorkspaceStyleScope css={[`
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `]}>{<Choices {...props} items={items} loading={loading} error={props.error || error || undefined} retry={() => void reload()}/>}</NativeWorkspaceStyleScope>;
}
export function AssistCatalogMultiSelect(props: Props) {
    if (props.items)
        return <NativeWorkspaceStyleScope css={[`
      .cs-assist-catalog{color:#244666;font:inherit;min-width:0}.cs-assist-catalog h4{font-size:14px;margin:0 0 10px;font-weight:650}
      .cs-assist-catalog-choices{display:flex;flex-wrap:wrap;gap:8px}.cs-assist-catalog button{font:inherit;cursor:pointer}
      .cs-assist-catalog-choices button{display:flex;align-items:center;gap:7px;min-height:40px;max-width:100%;text-align:left;overflow-wrap:anywhere;padding:8px 13px;border-radius:12px;border:1px solid #ccdcf0;color:#315b86;background:#f5f9ff;transition:background .15s,border-color .15s}
      .cs-assist-catalog-choices button:hover{background:#e7f1ff;border-color:#91b7eb}.cs-assist-catalog-choices button[aria-pressed=true]{background:#1264d3;border-color:#1264d3;color:white;box-shadow:0 3px 10px #1264d322}
      .cs-assist-catalog-choices button:focus-visible{outline:3px solid #80b4fb;outline-offset:3px}.cs-assist-catalog-choices button>span:first-child{width:16px;flex-shrink:0;text-align:center}
      .cs-assist-catalog-status{font-size:13px;line-height:1.6;color:#536b84;margin:8px 0}.cs-assist-catalog-error{color:#9b3438}.cs-assist-catalog-error button{margin-left:10px;color:inherit;border:0;background:transparent;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.cs-assist-catalog-choices button{transition:none}}
    `]}>{<Choices {...props}/>}</NativeWorkspaceStyleScope>;
    return props.catalogKey ? <FromCatalog {...props} catalogKey={props.catalogKey}/> : <Choices {...props}/>;
}
