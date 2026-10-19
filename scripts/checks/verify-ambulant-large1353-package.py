"""Restore a cumulative checkpoint into an independent public-base clone."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

source, archive, workbook, verification, unpacked, output = map(Path, sys.argv[1:7])
source, archive, workbook, verification, unpacked, output = [p.resolve() for p in (source, archive, workbook, verification, unpacked, output)]
BOOK = 'CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx'
BASES = {'543e51693ec637aa4ca9e017de06078ba7fe6e84', 'c8b2249c2a476bfea9a00bc9ad707ec91dce097f'}

def run(command, cwd=None):
    return subprocess.check_output(command, cwd=cwd, text=True, stderr=subprocess.PIPE)

head = run(['git', 'rev-parse', 'HEAD'], source).strip()
assert not run(['git', 'status', '--porcelain'], source).strip(), 'Source must be committed'
assert not (verification / '.git/objects/info/alternates').exists(), 'No shared object alternates'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    sums = dict((name, digest) for digest, name in (line.split('  ', 1) for line in z.read('SHA256SUMS.txt').decode().splitlines()))
    assert set(sums) == set(z.namelist()) - {'SHA256SUMS.txt'}
    for name, digest in sums.items():
        assert hashlib.sha256(z.read(name)).hexdigest() == digest, name
    assert z.read(BOOK) == workbook.read_bytes(), 'Embedded workbook differs'
    assert z.read('restore-ambulant-checkpoint.py') == (source / 'scripts/restore-ambulant-checkpoint.py').read_bytes()

restore = json.loads(run(['python3', str(source / 'scripts/restore-ambulant-checkpoint.py'), str(archive), str(unpacked)]))
bundle = unpacked / 'ambulant-checkpoint.bundle'
header = []
with bundle.open('rb') as stream:
    for line in stream:
        if line == b'\n':
            break
        header.append(line.decode().rstrip('\n'))
prerequisites = {line[1:41] for line in header if re.fullmatch(r'-[0-9a-f]{40}(?: .*)?', line)}
assert prerequisites == BASES, prerequisites
run(['git', 'bundle', 'verify', str(bundle)], verification)
assert run(['git', 'bundle', 'list-heads', str(bundle)], verification).strip() == head + ' HEAD'
run(['git', 'fetch', str(bundle), 'HEAD'], verification)
assert run(['git', 'rev-parse', 'FETCH_HEAD'], verification).strip() == head
run(['git', 'switch', '--detach', 'FETCH_HEAD'], verification)
assert not run(['git', 'status', '--porcelain'], verification).strip()
manifest = json.loads((unpacked / 'SOURCE_MANIFEST.json').read_text())
for entry in manifest['entries']:
    name = entry['path'].removeprefix('source/')
    original = (source / name).read_bytes()
    restored = (unpacked / entry['path']).read_bytes()
    checked_out = (verification / name).read_bytes()
    assert original == restored == checked_out, name
    assert len(restored) == entry['bytes'] and hashlib.sha256(restored).hexdigest() == entry['sha256'], name

tests = sorted(p.name for p in (source / 'scripts/checks').glob('client-intake-*.node.test.mjs'))
command = [os.environ.get('CODEX_PRIMARY_RUNTIME_NODE', 'node'), '--test', '--test-reporter=spec', *['scripts/checks/' + name for name in tests]]
test_result = subprocess.run(command, cwd=verification, capture_output=True, text=True)
test_log = test_result.stdout + test_result.stderr
output.with_suffix('.node.log').write_text(test_log)
assert test_result.returncode == 0, test_log[-3000:]
for field, expected in [('tests',424),('pass',424),('fail',0),('cancelled',0),('skipped',0),('todo',0)]:
    assert len(re.findall(r'^ℹ ' + field + r' ' + str(expected) + r'$', test_log, re.M)) == 1, field
consistency = json.loads(run(['python3', str(verification / 'scripts/verify-ambulant-checkpoint-inputs.py'), str(unpacked / BOOK)], verification))
milestone = run(['node', 'scripts/checks/ambulant-milestone-progress.mjs'], verification)
assert milestone == (verification / 'docs/audit/checks/ambulant-50-prozent-2026-10-08.json').read_text()
assert (unpacked / BOOK).read_bytes() == workbook.read_bytes()
assert not run(['git', 'status', '--porcelain'], verification).strip()
result = {
    'commit':head,'checkpoint':consistency['checkpoint'],
    'archiveBytes':archive.stat().st_size,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
    'allOuterCrcAndSha':'matched','allSourceNamesBytesSizesSha256':'matched',
    'sourceFiles':manifest['sourceCount'],'sourceRawBytes':manifest['sourceBytes'],
    'bundleBases':sorted(prerequisites),'bundleHead':head,'isolatedCheckoutClean':True,
    'objectAlternates':False,'embeddedWorkbookSha256':hashlib.sha256(workbook.read_bytes()).hexdigest(),
    'restoredTargetedTests':424,'inputConsistency':consistency,'milestoneByteIdentical':True,
    'accepted':json.loads(milestone)['accepted'],'goalReached':json.loads(milestone)['reached'],'restore':restore,
}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
