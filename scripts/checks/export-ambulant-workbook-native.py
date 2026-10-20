#!/usr/bin/env python3
from pathlib import Path
import json, sys
import openpyxl

source, output = map(Path, sys.argv[1:3])
book = openpyxl.load_workbook(source, data_only=False)
result = {}
for sheet in book.worksheets:
    cells = {}
    for row in sheet.iter_rows():
        for cell in row:
            value = '' if cell.value is None else cell.value
            formula = cell.value[1:] if isinstance(cell.value, str) and cell.value.startswith('=') else None
            cells[cell.coordinate] = [value, formula]
    result[sheet.title] = cells
output.write_text(json.dumps(result, ensure_ascii=False) + '\n')
print(json.dumps({'sheets':len(result),'cells':sum(len(v) for v in result.values())}))
