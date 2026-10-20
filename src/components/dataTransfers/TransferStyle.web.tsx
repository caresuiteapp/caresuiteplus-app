import { ConsoleStyle } from '@/components/platformConsole/ConsoleWorkspaceUi.web';

export function TransferStyle() {
  return <><ConsoleStyle /><style>{`
    .cs-transfer-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}
    .cs-transfer-file{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;border:1px solid #d8e3f0;border-radius:12px;background:#f8fbff;min-width:0}
    .cs-transfer-file>div:first-child{flex:1;min-width:0}.cs-transfer-file strong{display:block;overflow-wrap:anywhere;font-size:14px}.cs-transfer-file small{display:block;margin-top:5px}
    .cs-transfer-file progress{width:100%;height:10px;accent-color:#075dd5}.cs-transfer-file .cs-actions{flex-shrink:0}
    .cs-transfer-drop{padding:26px;border:2px dashed #90b4e0;border-radius:16px;background:#f4f8ff;display:grid;gap:12px}
    .cs-transfer-drop input{padding:10px;background:white}.cs-transfer-drop label{font-weight:700}
    .cs-transfer-launch{position:fixed;right:22px;bottom:24px;z-index:250;max-width:calc(100vw - 32px);box-shadow:0 8px 30px #16385b30}
    .cs-transfer-meta{display:flex;gap:12px;flex-wrap:wrap;color:#526580;font-size:13px}
    @media(max-width:600px){.cs-transfer-file{align-items:stretch;flex-direction:column;gap:12px}.cs-transfer-file .cs-actions{justify-content:flex-start}.cs-transfer-drop{padding:17px}.cs-transfer-launch{right:16px;bottom:16px}}
  `}</style></>;
}
