"""Verify CP348 from its archive in an isolated public-base checkout."""
from __future__ import annotations
import hashlib,json,os,re,subprocess,sys,zipfile
from pathlib import Path

source,archive,workbook,verification,unpacked,output=map(lambda value:Path(value).resolve(),sys.argv[1:7])
book='CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx'
bases={'543e51693ec637aa4ca9e017de06078ba7fe6e84','c8b2249c2a476bfea9a00bc9ad707ec91dce097f'}
def run(command,cwd=None):return subprocess.check_output(command,cwd=cwd,text=True,stderr=subprocess.PIPE)
head=run(['git','rev-parse','HEAD'],source).strip()
assert not (verification/'.git/objects/info/alternates').exists()
assert run(['git','rev-parse','HEAD'],verification).strip()==head
assert not run(['git','status','--porcelain'],verification).strip()
for base in bases:assert run(['git','cat-file','-t',base],verification).strip()=='commit'
with zipfile.ZipFile(archive) as package:
 assert package.testzip() is None
 sums=dict((name,digest) for digest,name in (line.split('  ',1) for line in package.read('SHA256SUMS.txt').decode().splitlines()))
 assert set(sums)==set(package.namelist())-{'SHA256SUMS.txt'}
 for name,digest in sums.items():assert hashlib.sha256(package.read(name)).hexdigest()==digest,name
 assert package.read(book)==workbook.read_bytes()
 assert package.read('restore-ambulant-checkpoint.py')==(source/'scripts/restore-ambulant-checkpoint.py').read_bytes()
bundle=unpacked/'ambulant-checkpoint.bundle'
header=[]
with bundle.open('rb') as stream:
 for raw in stream:
  if raw==b'\n':break
  header.append(raw.decode().rstrip())
prerequisites={line[1:41] for line in header if re.fullmatch(r'-[0-9a-f]{40}(?: .*)?',line)}
assert prerequisites==bases
run(['git','bundle','verify',str(bundle)],verification)
assert run(['git','bundle','list-heads',str(bundle)],verification).strip()==head+' HEAD'
manifest=json.loads((unpacked/'SOURCE_MANIFEST.json').read_text())
tree={}
for raw in subprocess.check_output(['git','ls-tree','-r','-z',head],cwd=verification).split(b'\0'):
 if raw:
  meta,name=raw.split(b'\t',1);_mode,kind,oid=meta.split(b' ');tree[name.decode()]=(kind,oid)
reader=subprocess.Popen(['git','cat-file','--batch'],cwd=verification,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
try:
 for entry in manifest['entries']:
  name=entry['path'].removeprefix('source/');kind,oid=tree[name];assert kind==b'blob'
  reader.stdin.write(oid+b'\n');reader.stdin.flush();parts=reader.stdout.readline().split();assert parts[:2]==[oid,b'blob']
  native=reader.stdout.read(int(parts[2]));assert reader.stdout.read(1)==b'\n'
  restored=(unpacked/entry['path']).read_bytes();physical=(verification/name).read_bytes()
  assert native==restored==physical,name
  assert len(restored)==entry['bytes'] and hashlib.sha256(restored).hexdigest()==entry['sha256'],name
finally:
 reader.stdin.close();reader.stdout.close();assert reader.wait()==0
node=os.environ.get('CODEX_PRIMARY_RUNTIME_NODE','node')
test_run=subprocess.run(['bash','-lc',f'{node} --test scripts/checks/*.node.test.mjs'],cwd=verification,capture_output=True,text=True)
test_log=test_run.stdout+test_run.stderr
output.with_suffix('.node.log').write_text(test_log)
assert test_run.returncode==0,test_log[-4000:]
for field,expected in [('tests',12210),('pass',12210),('fail',0),('cancelled',0),('skipped',0),('todo',0)]:assert re.search(rf'^ℹ {field} {expected}$',test_log,re.M),field
consistency=json.loads(run(['python3','scripts/verify-ambulant-checkpoint-inputs.py',str(unpacked/book)],verification))
milestone=run(['node','scripts/checks/ambulant-milestone-progress.mjs'],verification)
assert milestone==(verification/'docs/audit/checks/ambulant-50-prozent-2026-10-08.json').read_text()
assert not run(['git','status','--porcelain'],verification).strip()
result={'commit':head,'checkpoint':348,'archiveBytes':archive.stat().st_size,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'allOuterCrcAndSha':'matched','allSourceNamesBytesSizesSha256':'matched','sourceFiles':manifest['sourceCount'],'sourceRawBytes':manifest['sourceBytes'],'bundleBases':sorted(prerequisites),'bundleHead':head,'isolatedCheckoutClean':True,'objectAlternates':False,'embeddedWorkbookSha256':hashlib.sha256(workbook.read_bytes()).hexdigest(),'restoredNodeTests':12210,'inputConsistency':consistency,'milestoneByteIdentical':True,'accepted':json.loads(milestone)['accepted'],'goalReached':json.loads(milestone)['reached']}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
