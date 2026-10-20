"""Run the established isolated package verifier with CP354's exact totals."""
from pathlib import Path
template=Path(__file__).with_name('verify-ambulant-checkpoint-cp348.py').read_text()
source=(template.replace('Verify CP348 from its archive','Verify CP354 from its archive').replace("('tests',12210)","('tests',12331)").replace("('pass',12210)","('pass',12331)").replace("'checkpoint':348","'checkpoint':354").replace("'restoredNodeTests':12210","'restoredNodeTests':12331"))
if source==template or "'checkpoint':354" not in source or "'restoredNodeTests':12331" not in source:raise SystemExit('CP348 verification template no longer matches the reviewed CP354 adapter.')
exec(compile(source,str(Path(__file__)),'exec'),{'__name__':'__main__','__file__':str(Path(__file__))})
