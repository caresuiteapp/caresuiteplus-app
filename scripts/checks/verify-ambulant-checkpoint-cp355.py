"""Run the established isolated package verifier with CP355's exact totals."""
from pathlib import Path
template=Path(__file__).with_name('verify-ambulant-checkpoint-cp348.py').read_text()
source=(template.replace('Verify CP348 from its archive','Verify CP355 from its archive').replace("('tests',12210)","('tests',12349)").replace("('pass',12210)","('pass',12349)").replace("'checkpoint':348","'checkpoint':355").replace("'restoredNodeTests':12210","'restoredNodeTests':12349"))
if source==template or "'checkpoint':355" not in source or "'restoredNodeTests':12349" not in source:raise SystemExit('CP348 verification template no longer matches the reviewed CP355 adapter.')
exec(compile(source,str(Path(__file__)),'exec'),{'__name__':'__main__','__file__':str(Path(__file__))})
