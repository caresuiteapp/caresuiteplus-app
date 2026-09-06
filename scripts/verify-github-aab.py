#!/usr/bin/env python3
"""Check the downloadable bundle, including all six approved intro videos."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile


def verify(bundle):
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((root / 'assets/brand/intro/manifest.json').read_text())
    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        if 'BundleConfig.pb' not in names or 'base/manifest/AndroidManifest.xml' not in names:
            raise ValueError('Keine vollständige Android-App-Bundle-Struktur')
        if not any(re.fullmatch(r'META-INF/[^/]+\.(RSA|DSA|EC)', name, re.I) for name in names):
            raise ValueError('AAB enthält keine Upload-Signatur')
        video_hashes = {
            hashlib.sha256(archive.read(name)).hexdigest()
            for name in names if name.startswith('base/') and name.lower().endswith('.mp4')
        }
        missing = [item['file'] for item in manifest['formats'] if item['sha256'] not in video_hashes]
        if missing:
            raise ValueError('Intro im AAB fehlt oder wurde verändert: ' + ', '.join(missing))
    subprocess.run(['jarsigner', '-verify', str(bundle)], check=True)
    with bundle.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    (bundle.parent / 'SHA256SUMS.txt').write_text(f'{digest}  {bundle.name}\n')
    info = {
        'repository': os.environ.get('GITHUB_REPOSITORY'),
        'commit': os.environ.get('GITHUB_SHA'),
        'runId': os.environ.get('GITHUB_RUN_ID'),
        'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'builder': 'GitHub Actions / EAS local',
        'profile': 'portal-only-aab',
        'file': bundle.name,
        'sha256': digest,
        'bytes': bundle.stat().st_size,
        'introVersion': manifest['version'],
        'verifiedIntroFormats': len(manifest['formats']),
    }
    (bundle.parent / 'BUILD-INFO.json').write_text(json.dumps(info, indent=2) + '\n')
    print(f'AAB-Signatur und {len(manifest["formats"])} Introformate geprüft: {digest}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Aufruf: python3 scripts/verify-github-aab.py PFAD_ZUR_AAB')
    verify(Path(sys.argv[1]).resolve())
