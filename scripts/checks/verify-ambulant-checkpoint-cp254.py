"""Independently verify the cumulative CP254 checkpoint and restored source tree."""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = Path(sys.argv[1]).resolve()
WORKBOOK = Path(sys.argv[2]).resolve()
OUTPUT = Path(sys.argv[3]).resolve()
EXPECTED_HEAD = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
EXPECTED_BASES = {
    'c8b2249c2a476bfea9a00bc9ad707ec91dce097f',
    '543e51693ec637aa4ca9e017de06078ba7fe6e84',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


with tempfile.TemporaryDirectory(prefix='caresuite-cp254-verify-') as tmp_value:
    tmp = Path(tmp_value)
    with zipfile.ZipFile(ARCHIVE) as archive:
        if archive.testzip() is not None:
            raise SystemExit('ZIP CRC failure')
        names = set(archive.namelist())
        expected_names = {
            'README.txt', 'ambulant-checkpoint.bundle', 'ambulant-checkpoint.patch',
            'CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx', 'source.tar.xz',
            'SOURCE_MANIFEST.json', 'restore-ambulant-checkpoint.py', 'SHA256SUMS.txt',
        }
        if names != expected_names:
            raise SystemExit(f'Unexpected ZIP members: {sorted(names)}')
        sums = {}
        for line in archive.read('SHA256SUMS.txt').decode().splitlines():
            digest, name = line.split('  ', 1)
            sums[name] = digest
        for name in expected_names - {'SHA256SUMS.txt'}:
            if sha256(archive.read(name)) != sums.get(name):
                raise SystemExit(f'Outer SHA mismatch: {name}')
        helper_bytes = archive.read('restore-ambulant-checkpoint.py')
        if helper_bytes != (ROOT / 'scripts/restore-ambulant-checkpoint.py').read_bytes():
            raise SystemExit('Embedded restore helper differs from repository helper')
        embedded_workbook = archive.read('CareSuite_Ambulant_A-Z_Arbeitsliste_2026-10-08.xlsx')
        if embedded_workbook != WORKBOOK.read_bytes():
            raise SystemExit('Embedded workbook differs from verified workbook')

    restored = tmp / 'restored'
    subprocess.run([
        sys.executable, str(ROOT / 'scripts/restore-ambulant-checkpoint.py'),
        str(ARCHIVE), str(restored),
    ], cwd=ROOT, check=True)
    manifest = json.loads((restored / 'SOURCE_MANIFEST.json').read_text())
    source_root = restored / 'source'
    for item in manifest['entries']:
        relative = item['path'].removeprefix('source/')
        actual = source_root / relative
        current = ROOT / relative
        body = actual.read_bytes()
        if len(body) != item['bytes'] or sha256(body) != item['sha256']:
            raise SystemExit(f'Restored manifest mismatch: {relative}')
        if body != current.read_bytes():
            raise SystemExit(f'Restored source differs from repository: {relative}')

    verify = subprocess.check_output(
        ['git', 'bundle', 'verify', str(restored / 'ambulant-checkpoint.bundle')],
        cwd=ROOT, text=True, stderr=subprocess.STDOUT,
    )
    prerequisites = {
        match.group(1)
        for line in verify.splitlines()
        if (match := re.fullmatch(r'([0-9a-f]{40})\s*', line))
    }
    if prerequisites != EXPECTED_BASES:
        raise SystemExit(f'Unexpected bundle prerequisites: {sorted(prerequisites)}')
    bare = tmp / 'metadata.git'
    subprocess.run(['git', 'init', '--bare', str(bare)], check=True, stdout=subprocess.DEVNULL)
    env = os.environ | {'GIT_ALTERNATE_OBJECT_DIRECTORIES': str(ROOT / '.git/objects')}
    subprocess.run(
        ['git', '-C', str(bare), 'fetch', str(restored / 'ambulant-checkpoint.bundle'), 'HEAD'],
        check=True, env=env, stdout=subprocess.DEVNULL,
    )
    fetched_head = subprocess.check_output(['git', '-C', str(bare), 'rev-parse', 'FETCH_HEAD'], text=True).strip()
    if fetched_head != EXPECTED_HEAD:
        raise SystemExit(f'Bundle HEAD mismatch: {fetched_head}')

    checkout = tmp / 'checkout'
    checkout.mkdir()
    subprocess.run(
        ['git', '--git-dir', str(bare), '--work-tree', str(checkout),
         'checkout', '--force', 'FETCH_HEAD', '--', '.'],
        check=True, env=env, stdout=subprocess.DEVNULL,
    )

    node = os.environ.get('CODEX_PRIMARY_RUNTIME_NODE', 'node')
    test = subprocess.run(
        [node, '--test', 'scripts/checks/client-portal-actor-scope.node.test.mjs'],
        cwd=checkout, text=True, capture_output=True,
    )
    if (test.returncode or not re.search(r'(?:#|ℹ)\s+pass 10', test.stdout)
            or not re.search(r'(?:#|ℹ)\s+fail 0', test.stdout)):
        raise SystemExit(f'Restored W-04 test result is not 10/10:\n{test.stdout}\n{test.stderr}')
    milestone = subprocess.check_output(
        [node, 'scripts/checks/ambulant-milestone-progress.mjs'], cwd=checkout,
    )
    stored_milestone = (checkout / 'docs/audit/checks/ambulant-milestone-progress-checkpoint254-2026-10-14.json').read_bytes()
    canonical_milestone = (checkout / 'docs/audit/checks/ambulant-50-prozent-2026-10-08.json').read_bytes()
    if milestone != stored_milestone or milestone != canonical_milestone:
        raise SystemExit('Restored milestone report is not byte-identical')
    milestone_data = json.loads(milestone)
    if milestone_data['reached'] or milestone_data['accepted'] != 1:
        raise SystemExit('Unexpected milestone status')

    result = {
        'checkpoint': 254,
        'commit': EXPECTED_HEAD,
        'archiveBytes': ARCHIVE.stat().st_size,
        'archiveSha256': sha256(ARCHIVE.read_bytes()),
        'zipMembers': len(expected_names),
        'sourceFiles': manifest['sourceCount'],
        'sourceRawBytes': manifest['sourceBytes'],
        'sourceComparison': 'byte-identical',
        'embeddedWorkbookSha256': sha256(embedded_workbook),
        'embeddedHelper': 'byte-identical',
        'bundlePrerequisites': sorted(prerequisites),
        'bundleHead': fetched_head,
        'restoredW04Tests': '10/10',
        'milestone': {
            'accepted': milestone_data['accepted'],
            'required': milestone_data['required'],
            'reached': milestone_data['reached'],
            'byteIdentical': True,
        },
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
