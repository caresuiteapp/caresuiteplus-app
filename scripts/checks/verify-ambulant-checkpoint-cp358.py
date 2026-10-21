"""Run the established isolated package verifier with CP358's exact totals."""
from pathlib import Path
template=Path(__file__).with_name('verify-ambulant-checkpoint-cp348.py').read_text()
source=(template.replace('Verify CP348 from its archive','Verify CP358 from its archive').replace("('tests',12210)","('tests',12400)").replace("('pass',12210)","('pass',12400)").replace("'checkpoint':348","'checkpoint':358").replace("'restoredNodeTests':12210","'restoredNodeTests':12400"))
if source==template or "'checkpoint':358" not in source or "'restoredNodeTests':12400" not in source:raise SystemExit('CP348 verification template no longer matches the reviewed CP358 adapter.')
exec(compile(source,str(Path(__file__)),'exec'),{'__name__':'__main__','__file__':str(Path(__file__))})
