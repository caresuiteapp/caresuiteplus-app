"""Build the cumulative, local-only ambulatory review checkpoint. No remote writes."""
import hashlib,importlib.util,io,json,lzma,re,subprocess,sys,tarfile,zipfile
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='c8b2249c2a476bfea9a00bc9ad707ec91dce097f'
OUT=Path(sys.argv[1]).resolve()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
if git('status','--porcelain').strip():raise SystemExit('Commit local changes before building a reproducible checkpoint.')
head=git('rev-parse','HEAD').decode().strip()
built_at=datetime.now(timezone.utc).isoformat()
catalog=json.loads((ROOT/'docs/audit/ambulant-az-katalog-2026-10-08.json').read_text())
progress=json.loads((ROOT/'docs/audit/checks/ambulant-50-prozent-2026-10-08.json').read_text())
preflight_path=ROOT/'scripts/verify-ambulant-checkpoint-inputs.py'
preflight_spec=importlib.util.spec_from_file_location('checkpoint_preflight',preflight_path)
preflight=importlib.util.module_from_spec(preflight_spec);preflight_spec.loader.exec_module(preflight)
consistency=preflight.verify_inputs(ROOT,OUT/preflight.BOOK)
test_count=consistency['nodeTests']
OUT.mkdir(parents=True,exist_ok=True)
bundle=OUT/'ambulant-checkpoint.bundle'
git('bundle','create',str(bundle),'HEAD','^'+BASE)
git('bundle','verify',str(bundle))
# Keep the reversible binary patch in memory: no duplicate 350+ MB temporary file.
patch_body=git('diff','--binary',BASE,'HEAD')
source_entries={}
tree={}
for raw in git('ls-tree','-r','-z',head).split(b'\0'):
 if not raw:continue
 meta,name=raw.split(b'\t',1);mode,kind,oid=meta.split(b' ');tree[name.decode('utf-8')]=(mode,kind,oid)
# Read every changed current blob from the committed tree. Sparse checkouts cannot
# silently omit source evidence; deleted files remain represented by bundle/patch.
reader=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
try:
 for name in git('diff','--name-only','-z',BASE,head).decode('utf-8').split('\0'):
  if not name or name not in tree:continue
  mode,kind,oid=tree[name]
  if kind!=b'blob' or mode not in (b'100644',b'100755'):raise SystemExit('Nonregular changed source needs review: '+name)
  if any(part.startswith('.env') for part in Path(name).parts):raise SystemExit('Environment file excluded; inspect changed paths.')
  reader.stdin.write(oid+b'\n');reader.stdin.flush();parts=reader.stdout.readline().split()
  if len(parts)!=3 or parts[0]!=oid or parts[1]!=b'blob':raise SystemExit('Native source object is unavailable: '+name)
  body=reader.stdout.read(int(parts[2]))
  if len(body)!=int(parts[2]) or reader.stdout.read(1)!=b'\n':raise SystemExit('Truncated native source object: '+name)
  source_entries['source/'+name]=body
finally:
 reader.stdin.close();reader.stdout.close()
 if reader.wait()!=0:raise SystemExit('Native source object reader failed.')
helper=ROOT/'scripts/restore-ambulant-checkpoint.py'
spec=importlib.util.spec_from_file_location('checkpoint_restore',helper)
restore=importlib.util.module_from_spec(spec);spec.loader.exec_module(restore)
manifest={'format':'caresuite-source-tarxz-v1','sourceCount':len(source_entries),'sourceBytes':sum(len(b) for b in source_entries.values()),'entries':[]}
source_archive=OUT/'source.tar.xz'
# Preset 3 retains the verified TAR/XZ/CRC64 contract with a useful cross-file dictionary.
with lzma.LZMAFile(source_archive,'wb',format=lzma.FORMAT_XZ,check=lzma.CHECK_CRC64,preset=3) as compressed:
 with tarfile.open(fileobj=compressed,mode='w|',format=tarfile.PAX_FORMAT) as t:
  for name,body in source_entries.items():
   restore.safe_source(name)
   member=tarfile.TarInfo(name);member.size=len(body);member.mode=0o644
   t.addfile(member,io.BytesIO(body))
   manifest['entries'].append({'path':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
restore.verify_tar(source_archive,{item['path']:item for item in manifest['entries']})
entries={'SOURCE_MANIFEST.json':(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode(),'restore-ambulant-checkpoint.py':helper.read_bytes()}
for name in ['ambulant-checkpoint.bundle','CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx']:entries[name]=(OUT/name).read_bytes()
entries['ambulant-checkpoint.patch']=patch_body
if hashlib.sha256(entries[preflight.BOOK]).hexdigest()!=consistency['workbookSha256']:raise SystemExit('Workbook changed after consistency verification.')
goal_note='ERREICHT' if progress['reached'] else 'NICHT erreicht'
entries['README.txt']=f'''CareSuite Ambulant – Checkpoint {catalog['version']}
Paket erstellt (UTC): {built_at}
Lokaler Commit: {head}
Basis: {BASE}
Kumulative lokale Änderungen, Aufgaben, Nachweise und nächste Arbeitspunkte. {catalog.get('checkpointSummary','Assessment-Schreibabläufe lokal erweitert.')} Vitalmessungen, Nachkontrollen und eigenes Pflegeassessment aus vorherigem Stand enthalten. {test_count}/{test_count} lokale Domänen-/Gatewayfälle bestanden. {progress['accepted']}/{progress['total']} Aufgaben vollständig abgenommen; 50%-Ziel je Bereich ({progress['required']} Aufgaben) {goal_note}.
Keine echte SQL-/RLS-/React-/Metro-/SDK-/Browserabnahme oder Gesamt-Typecheck. Keine pflegerische/rechtliche Modulfreigabe. Kein Push/Deployment, keine produktiven Datenänderungen. Keine Abhängigkeiten installiert oder beigefügt.

Bundle benötigt vorhandene Basis {BASE} und 543e51693ec637aa4ca9e017de06078ba7fe6e84. Neue Arbeitsumgebung ohne erhaltenen lokalen Checkout ausschließlich lesend wiederherstellen:
git clone --filter=blob:none --no-checkout https://github.com/caresuiteapp/caresuiteplus-app.git /absoluter/pfad/caresuite-wiederherstellung
cd /absoluter/pfad/caresuite-wiederherstellung
git fetch --filter=blob:none --no-tags origin {BASE} 543e51693ec637aa4ca9e017de06078ba7fe6e84
Bei einem Teilclone muss der öffentliche origin beim Wechsel auf den gesicherten HEAD für fehlende unveränderte Dateiobjekte lesend erreichbar bleiben. Ein vorhandener Teilclone ohne sämtliche Basis-Dateiobjekte genügt nicht als vollständige lokale Fetchquelle. Keine bestehende fremde Arbeitskopie überschreiben. Im vorbereiteten Repository:
git bundle verify /absoluter/pfad/ambulant-checkpoint.bundle
git fetch /absoluter/pfad/ambulant-checkpoint.bundle HEAD
git switch -c work/ambulant-checkpoint{catalog['version']} FETCH_HEAD
Alternativ Patch zuerst mit git apply --check prüfen. SQL nur Vorbereitung; bei Veröffentlichung Reihenfolge, Altwriter, Rechte, Rückgabe/Fortschreibung und Aufbewahrung nachweisen. Einzelheiten: source/docs/audit/ambulant-fortsetzung-2026-10-08.md.
Quellenformat caresuite-source-tarxz-v1: Alle vollständigen source/<Repositorypfad>-Dateiinhalte einschließlich Originalhistorien und Prüfprogrammen stehen verlustfrei in source.tar.xz. SOURCE_MANIFEST.json nennt jeden Pfad, Byteumfang und SHA256; SHA256SUMS.txt prüft alle übrigen äußeren Dateien. Keine Quellen oder fehlgeschlagenen Prüfprotokolle wurden für die Kompression weggelassen. Standard Python tarfile/PAX und lzma/XZ genügen ohne Installation.

Zum Starten restore-ambulant-checkpoint.py aus diesem bekannten gesicherten ZIP lesen und gegen seinen SHA256SUMS.txt-Eintrag prüfen. Hashes/CRC belegen Integrität, nicht selbst die Herkunft; die kanonische Version getrennt prüfen. Ausschließlich in ein noch NICHT vorhandenes neues Ziel entpacken:
python /absoluter/pfad/restore-ambulant-checkpoint.py /absoluter/pfad/CareSuite_Ambulant_Arbeitscheckpoint_2026-10-08.zip /absoluter/pfad/checkpoint-unpacked
Der Helper prüft zuerst alle äußeren SHA/CRC und anschließend alle Sourcepfade, regulären Dateien, Mengen, Bytes und SHA vor Zielanlage. Links, Traversierung, doppelte/unvereinbarte Dateien und bestehende Ziele werden abgewiesen. Alte flache ZIPs mit source/* bleiben separat unterstützt. Er führt keinen Git-, Netzwerk-, Installations- oder Schreibzugriff auf bestehende Checkouts aus. Ein I/O-Fehler nach Zielanlage hinterlässt ein eindeutig partielles neues Ziel, das nicht als erfolgreich gilt.
Danach den oben beschriebenen unveränderten Basis-/Bundle-/isolierten-Branchablauf mit checkpoint-unpacked/ambulant-checkpoint.bundle ausführen. Alle Dateien aus checkpoint-unpacked/source/ byteweise mit dem isolierten Checkout vergleichen. Sourcebelege ersetzen keine unveränderten Basisobjekte oder Git-Historie. Kumulative QAprogramme lassen sich aus source/docs/audit/checks in eine eigene QAumgebung materialisieren; historische absolute Pfade kontrolliert an das neue lokale Ziel anpassen, ohne die gesicherten Originalprogramme zu überschreiben.
'''.encode()
entries['source.tar.xz']=source_archive.read_bytes()
entries['SHA256SUMS.txt']=''.join(hashlib.sha256(b).hexdigest()+'  '+n+'\n' for n,b in entries.items()).encode()
archive=OUT/'CareSuite_Ambulant_Arbeitscheckpoint_2026-10-08.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
 # Bundle, workbook and source archive are already compressed. Preserve their bytes.
 for name,body in entries.items():z.writestr(name,body,compress_type=zipfile.ZIP_STORED if name in ('source.tar.xz','ambulant-checkpoint.bundle',preflight.BOOK) else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(archive) as z:
 if z.testzip() is not None:raise SystemExit('ZIP CRC failure')
 for name,body in entries.items():
  if z.read(name)!=body:raise SystemExit('Checkpoint byte mismatch')
 if set(z.namelist())!=restore.OUTER:raise SystemExit('Unexpected format entries')
 for name,body in source_entries.items():
  path=ROOT/name.removeprefix('source/')
  if path.is_symlink() or path.is_file() and path.read_bytes()!=body:raise SystemExit('Source changed during build')
 if git('rev-parse','HEAD').decode().strip()!=head or git('status','--porcelain').strip():raise SystemExit('Checkout changed during build')
 if (OUT/preflight.BOOK).read_bytes()!=entries[preflight.BOOK]:raise SystemExit('Workbook changed during build')
print(json.dumps({'commit':head,'checkpoint':catalog['version'],'zipEntries':len(entries),'sourceFiles':len(source_entries),'sourceRawBytes':manifest['sourceBytes'],'bytes':archive.stat().st_size,'sourceBytes':'matched','crc':'passed','format':manifest['format'],'accepted':progress['accepted'],'goalReached':progress['reached']}))
