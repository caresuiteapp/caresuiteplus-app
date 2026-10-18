export const wfmOfficeReviewCss = `
[data-wfm-review]{color:#102b49;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;min-width:0;width:100%;box-sizing:border-box;container-type:inline-size}
[data-wfm-review] *{box-sizing:border-box}
[data-wfm-review] h2,[data-wfm-review] h3,[data-wfm-review] p{margin:0}
[data-wfm-review] h2{font-size:1.35em;line-height:1.3;letter-spacing:-.02em}
[data-wfm-review] h3{font-size:1em;line-height:1.4}
[data-wfm-review] button,[data-wfm-review] input,[data-wfm-review] select,[data-wfm-review] textarea{font:inherit;color:inherit}
[data-wfm-review] button{cursor:pointer}
[data-wfm-review] button:disabled{opacity:.5;cursor:not-allowed;transform:none}
[data-wfm-review] :focus-visible{outline:3px solid #2878d8;outline-offset:3px}
[data-wfm-review] .wr-head{display:flex;gap:16px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:14px}
[data-wfm-review] .wr-muted{color:#4c6580;font-size:.92em}
[data-wfm-review] .wr-button{border:1px solid #b7cde3;border-radius:9px;min-height:38px;padding:7px 13px;background:#fff;font-weight:650;box-shadow:0 1px 2px #1d4d7910;transition:background .16s,box-shadow .16s,transform .16s;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-align:center;line-height:1.35}
[data-wfm-review] .wr-button:hover:not(:disabled){background:#edf5ff;border-color:#83aedc;box-shadow:0 3px 9px #1d4d7918;transform:translateY(-1px)}
[data-wfm-review] .wr-button[data-primary=true]{background:#0969cd;border-color:#0969cd;color:#fff}
[data-wfm-review] .wr-button[data-primary=true]:hover:not(:disabled){background:#0758ae}
[data-wfm-review] .wr-button[data-danger=true]{color:#a32323;border-color:#e6b5b5;background:#fff8f8}
[data-wfm-review] .wr-toolbar{padding:12px;border:1px solid #d8e5f2;border-radius:12px;background:#f5f9ff;display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-bottom:12px}
[data-wfm-review] .wr-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-weight:600;font-size:.92em;flex:1 1 160px}
[data-wfm-review] .wr-field input,[data-wfm-review] .wr-field select,[data-wfm-review] .wr-field textarea{width:100%;min-width:0;border:1px solid #afc6dc;border-radius:8px;background:white;min-height:39px;padding:8px 10px;font-weight:400;color:#132f4f}
[data-wfm-review] .wr-field input:disabled,[data-wfm-review] .wr-field select:disabled,[data-wfm-review] .wr-field textarea:disabled{background:#eef2f7}
[data-wfm-review] .wr-field textarea{resize:vertical;min-height:82px;line-height:1.5}
[data-wfm-review] .wr-stats{display:flex;flex-wrap:wrap;gap:0;border:1px solid #d8e5f2;border-radius:12px;background:#fff;margin-bottom:12px;overflow:hidden}
[data-wfm-review] .wr-stat{padding:10px 14px;flex:1 1 120px;border-right:1px solid #e5edf5;min-width:0}
[data-wfm-review] .wr-stat strong{font-size:1.5em;display:block;font-variant-numeric:tabular-nums;color:#0c5caa;line-height:1.25}
[data-wfm-review] .wr-stat span{font-size:.85em;color:#4c6580}
[data-wfm-review] .wr-batch{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#eaf4ff;border:1px solid #c6def5;border-radius:10px;margin-bottom:12px}
[data-wfm-review] .wr-batch-info{flex:1 1 230px;font-size:.9em}
[data-wfm-review] .wr-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
[data-wfm-review] .wr-message{padding:11px 13px;border:1px solid #d5e3f1;border-radius:10px;background:#f5f9ff;margin-bottom:12px;overflow-wrap:anywhere}
[data-wfm-review] .wr-message[data-tone=error]{background:#fff4f3;border-color:#e6b8b2;color:#9c2626}
[data-wfm-review] .wr-message[data-tone=warning]{background:#fff9e9;border-color:#e8d398;color:#73500c}
[data-wfm-review] .wr-message p + p,[data-wfm-review] .wr-message .wr-button{margin-top:7px}
[data-wfm-review] .wr-scroll{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:auto;scrollbar-color:#8baccb #edf3fa;border:1px solid #cfdeec;border-radius:12px;background:white;max-width:100%;margin-top:8px}
[data-wfm-review] .wr-table{border-collapse:separate;border-spacing:0;table-layout:fixed;width:100%;min-width:1050px;text-align:left}
[data-wfm-review] .wr-table th{background:#edf5fe;color:#274d72;font-size:.82em;letter-spacing:.015em;font-weight:700;padding:11px 10px;border-bottom:1px solid #c7dbef}
[data-wfm-review] .wr-table td{padding:12px 10px;border-bottom:1px solid #e2ebf3;vertical-align:top;overflow-wrap:anywhere;font-size:.93em}
[data-wfm-review] .wr-table tbody tr:nth-child(even){background:#f8fbff}
[data-wfm-review] .wr-table tbody tr:hover{background:#edf5ff}
[data-wfm-review] .wr-table tbody tr[data-selected=true]{background:#e5f1ff}
[data-wfm-review] .wr-table tbody tr:last-child td{border-bottom:0}
[data-wfm-review] .wr-table td strong{display:block;font-weight:650}
[data-wfm-review] .wr-table td small{display:block;color:#4c6580;font-size:.9em;margin-top:3px}
[data-wfm-review] .wr-table .wr-button{min-height:34px;padding:6px 9px;width:100%;font-size:.9em}
[data-wfm-review] .wr-row-actions{display:flex;flex-direction:column;gap:6px}
[data-wfm-review] .wr-check{display:flex;align-items:center;justify-content:center;min-width:32px;min-height:34px}
[data-wfm-review] .wr-check input{width:19px;height:19px;accent-color:#0969cd;cursor:pointer}
[data-wfm-review] .wr-badge{display:inline-block;border-radius:6px;border:1px solid #c5d4e4;background:#eff4f9;color:#395570;font-size:.8em;font-weight:650;padding:3px 7px;line-height:1.35;margin:0 3px 4px 0;max-width:100%;overflow-wrap:anywhere}
[data-wfm-review] .wr-badge[data-tone=green]{background:#e8f8ee;border-color:#a8d7b8;color:#176238}
[data-wfm-review] .wr-badge[data-tone=yellow],[data-wfm-review] .wr-badge[data-tone=warning]{background:#fff4d7;border-color:#e6cd86;color:#7a5308}
[data-wfm-review] .wr-badge[data-tone=red]{background:#ffeded;border-color:#e6b4b4;color:#9e2424}
[data-wfm-review] .wr-badge[data-tone=blue]{background:#e8f2ff;border-color:#a9c9ed;color:#195da3}
[data-wfm-review] .wr-empty{padding:30px 20px;text-align:center;border:1px dashed #bdcfe0;border-radius:12px;background:#f8fbff}
[data-wfm-review] .wr-foot{font-size:.85em;color:#4c6580;margin-top:9px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
[data-wfm-review] .wr-detail-summary{padding:12px;border:1px solid #cbdff1;background:#f5faff;border-radius:12px;margin-bottom:14px}
[data-wfm-review] .wr-detail-times{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#dbe6f2;border:1px solid #dbe6f2;border-radius:10px;overflow:hidden;margin:10px 0}
[data-wfm-review] .wr-time{padding:10px;background:white;min-width:0}
[data-wfm-review] .wr-time strong{display:block;font-size:.85em;color:#4c6580;margin-bottom:4px}
[data-wfm-review] .wr-time p{font-size:.92em;overflow-wrap:anywhere}
[data-wfm-review] .wr-detail-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px}
[data-wfm-review] .wr-detail-section{border:1px solid #cfdeec;border-radius:12px;background:white;padding:14px;min-width:0;display:flex;flex-direction:column;gap:12px;align-self:start}
[data-wfm-review] .wr-detail-section form{display:flex;flex-direction:column;gap:12px}
[data-wfm-review] fieldset{border:0;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:12px}
[data-wfm-review] .wr-history{margin-top:14px;border:1px solid #cfdeec;border-radius:10px;background:#fff;padding:12px}
[data-wfm-review] .wr-history summary{cursor:pointer;font-weight:650}
[data-wfm-review] .wr-history ul{padding:0 0 0 18px;margin:12px 0 0}
[data-wfm-review] .wr-history li{margin:0 0 10px}
[data-wfm-review] .wr-history time{color:#4c6580;font-size:.85em;display:block}
@container (max-width:620px){[data-wfm-review] .wr-detail-grid{grid-template-columns:minmax(0,1fr)}[data-wfm-review] .wr-detail-times{grid-template-columns:minmax(0,1fr)}[data-wfm-review] .wr-head{gap:9px}[data-wfm-review] .wr-stat{flex-basis:100px}[data-wfm-review] .wr-batch .wr-button{flex:1 1 140px}}
@media(prefers-reduced-motion:reduce){[data-wfm-review] .wr-button{transition:none}[data-wfm-review] .wr-button:hover:not(:disabled){transform:none}}
`;
