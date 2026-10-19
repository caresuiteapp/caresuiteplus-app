"""Run the established isolated package verifier with CP357's exact totals."""
from pathlib import Path
template=Path(__file__).with_name('verify-ambulant-checkpoint-cp348.py').read_text()
source=(template.replace('Verify CP348 from its archive','Verify CP357 from its archive').replace("('tests',12210)","('tests',12385)").replace("('pass',12210)","('pass',12385)").replace("'checkpoint':348","'checkpoint':357").replace("'restoredNodeTests':12210","'restoredNodeTests':12385"))
if source==template or "'checkpoint':357" not in source or "'restoredNodeTests':12385" not in source:raise SystemExit('CP348 verification template no longer matches the reviewed CP357 adapter.')
exec(compile(source,str(Path(__file__)),'exec'),{'__name__':'__main__','__file__':str(Path(__file__))})
