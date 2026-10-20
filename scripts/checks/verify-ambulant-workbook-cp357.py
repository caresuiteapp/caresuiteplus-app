"""Verify CP357 workbook edits against the CP356 source workbook."""
from pathlib import Path
template=Path(__file__).with_name('verify-ambulant-workbook-cp353.py').read_text()
source=(template.replace('CP353 workbook edits against the CP352 source workbook','CP357 workbook edits against the CP356 source workbook').replace('TASK_ROWS=set(range(151,159));PACKET_ROWS=set(range(61,64))','TASK_ROWS=set(range(191,201));PACKET_ROWS=set(range(76,80))'))
if source==template or 'TASK_ROWS=set(range(191,201))' not in source:raise SystemExit('CP353 workbook verifier template no longer matches the reviewed CP357 adapter.')
exec(compile(source,str(Path(__file__)),'exec'),{'__name__':'__main__','__file__':str(Path(__file__))})
