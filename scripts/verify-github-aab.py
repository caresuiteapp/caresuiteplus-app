#!/usr/bin/env python3
"""Check the downloadable bundle, including all six approved intro videos."""
import hashlib
import codecs
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import zipfile


def proto_fields(data):
    """Read the bounded wire fields used by AAPT2 Resources.proto."""
    offset = 0

    def varint():
        nonlocal offset
        value = 0
        for shift in range(0, 70, 7):
            if offset >= len(data):
                raise ValueError('Unvollständiges Manifest-Protobuf')
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
        raise ValueError('Ungültiges Manifest-Protobuf')

    while offset < len(data):
        tag = varint()
        field, wire = tag >> 3, tag & 7
        if not field:
            raise ValueError('Ungültiges Manifest-Feld')
        if wire == 0:
            value = varint()
        elif wire in (1, 2, 5):
            size = varint() if wire == 2 else (8 if wire == 1 else 4)
            end = offset + size
            if end > len(data):
                raise ValueError('Unvollständiges Manifest-Feld')
            value = data[offset:end]
            offset = end
        else:
            raise ValueError('Nicht unterstütztes Manifest-Feld')
        yield field, value


def read_manifest_identity(data):
    # Schema: AOSP tools/aapt2/Resources.proto, XmlNode/XmlElement/XmlAttribute.
    root = dict(proto_fields(data)).get(1)
    if not isinstance(root, bytes):
        raise ValueError('Manifest-Wurzel fehlt')
    attributes = {}
    root_name = None
    for field, value in proto_fields(root):
        if field == 3:
            root_name = value.decode('utf-8')
        if field != 4:
            continue
        attr = dict(proto_fields(value))
        namespace = attr.get(1, b'').decode('utf-8')
        name = attr.get(2, b'').decode('utf-8')
        text = attr.get(3, b'').decode('utf-8')
        if not text and 6 in attr:
            item = dict(proto_fields(attr[6]))
            if 7 in item:
                primitive = dict(proto_fields(item[7]))
                number = primitive.get(6, primitive.get(7))
                if isinstance(number, int):
                    text = str(number)
            elif 2 in item or 3 in item:
                string = dict(proto_fields(item.get(2, item.get(3))))
                text = string.get(1, b'').decode('utf-8')
        key = (namespace, name)
        if key in attributes:
            raise ValueError('Doppeltes Manifest-Attribut')
        attributes[key] = text
    if root_name != 'manifest':
        raise ValueError('Keine Manifest-Wurzel')
    android = 'http://schemas.android.com/apk/res/android'
    identity = {
        'applicationId': attributes.get(('', 'package')),
        'versionName': attributes.get((android, 'versionName')),
        'versionCode': int(attributes.get((android, 'versionCode'), '0')),
    }
    return identity


def verify_identity(identity, expected_version):
    if identity['applicationId'] != 'app.caresuitehealthos':
        raise ValueError('AAB gehört nicht zur vorhandenen CareSuite-Play-App')
    if identity['versionName'] != expected_version:
        raise ValueError('AAB enthält nicht die erwartete App-Version')
    if identity['versionCode'] <= 40:
        raise ValueError('AAB-versionCode muss über dem bekannten Play-Stand 40 liegen')


def verify_upload_certificate(bundle, expected_sha256):
    output = subprocess.run(['keytool', '-J-Duser.language=en', '-printcert', '-jarfile', str(bundle), '-rfc'], check=True, capture_output=True, text=True).stdout
    certificates = re.findall(r'-----BEGIN CERTIFICATE-----\s+([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----', output)
    if not certificates:
        raise ValueError('Das tatsächliche AAB-Uploadzertifikat konnte nicht gelesen werden')
    import base64
    digest = hashlib.sha256(base64.b64decode(certificates[0])).hexdigest().upper()
    fingerprint = ':'.join(digest[i:i + 2] for i in range(0, len(digest), 2))
    if fingerprint != expected_sha256.upper():
        raise ValueError('AAB passt nicht zum bestehenden Google-Play-Uploadzertifikat: ' + fingerprint)
    return fingerprint


def verify_native_bundle(data):
    expected = ['native-administration-desktop', 'Neues Passwort speichern', 'Ohne Anmeldung ein Support-Ticket einreichen', 'Neo-Assistent', 'Google Workspace']
    # Hermes stores strings containing umlauts as UTF-16, including their ASCII
    # prefixes. The bundle is binary; both encodings must be checked directly.
    missing = [marker for marker in expected if marker.encode('utf-8') not in data and marker.encode('utf-16-le') not in data]
    if missing:
        raise ValueError('Vollständige native App-Oberflächen fehlen im gebauten AAB: ' + ', '.join(missing))
    return len(expected)


def verify_r8_artifacts(path, expected_mapping_sha256=None):
    if not path.is_file():
        raise ValueError('Das R8-Mapping-Archiv des tatsächlichen Builds fehlt')
    with tarfile.open(path, 'r:gz') as archive:
        def one_member(name, limit):
            files = [item for item in archive.getmembers() if item.isfile() and Path(item.name).name == name]
            if len(files) != 1:
                raise ValueError(f'R8-Artefakt {name}: genau eine Datei erwartet, gefunden: {len(files)}')
            if not 0 < files[0].size <= limit:
                raise ValueError(f'R8-Artefakt {name}: unzulässige Größe {files[0].size} Bytes (Maximum {limit})')
            return files[0]
        # The actual full build produces a 125 MB mapping. Validate/hash it in
        # bounded chunks instead of loading it into memory or rejecting 50 MB.
        mapping_member = one_member('mapping.txt', 512 * 1024 * 1024)
        mapping_hash = hashlib.sha256()
        mapping_header = bytearray()
        decoder = codecs.getincrementaldecoder('utf-8')()
        with archive.extractfile(mapping_member) as source:
            while chunk := source.read(256 * 1024):
                mapping_hash.update(chunk)
                decoder.decode(chunk)
                mapping_header.extend(chunk[:max(0, 65536 - len(mapping_header))])
            decoder.decode(b'', final=True)
        if not re.search(r'^#\s*compiler:\s*r8\b', mapping_header.decode('utf-8', errors='ignore'), re.M | re.I):
            raise ValueError('Das Mapping gehört nicht zu einem R8-Build')
        if expected_mapping_sha256 and mapping_hash.hexdigest() != expected_mapping_sha256:
            raise ValueError('R8-Mapping stimmt nicht mit dem signierten Mapping im AAB überein')
        with archive.extractfile(one_member('configuration.txt', 50 * 1024 * 1024)) as source:
            configuration = source.read().decode('utf-8')
        if re.search(r'^\s*-(?:dontoptimize|dontshrink|dontobfuscate)\b', configuration, re.M):
            raise ValueError('Die tatsächlich zusammengeführten R8-Regeln deaktivieren Release-Optimierungen')
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def verify(bundle):
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((root / 'assets/brand/intro/manifest.json').read_text())
    expected_version = json.loads((root / 'app.json').read_text())['expo']['version']
    signing = json.loads((root / 'docs/store/android-signing-identity.json').read_text())
    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        if 'BundleConfig.pb' not in names or 'base/manifest/AndroidManifest.xml' not in names:
            raise ValueError('Keine vollständige Android-App-Bundle-Struktur')
        if not any(re.fullmatch(r'META-INF/[^/]+\.(RSA|DSA|EC)', name, re.I) for name in names):
            raise ValueError('AAB enthält keine Upload-Signatur')
        identity = read_manifest_identity(archive.read('base/manifest/AndroidManifest.xml'))
        verify_identity(identity, expected_version)
        native_bundles = [name for name in names if name.startswith('base/assets/') and name.endswith('.bundle')]
        if len(native_bundles) != 1:
            raise ValueError('Genau ein nativer JavaScript/Hermes-Bundle erwartet')
        native_markers = verify_native_bundle(archive.read(native_bundles[0]))
        mapping_entry = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map'
        if names.count(mapping_entry) != 1:
            raise ValueError('Das signierte R8-Mapping im AAB fehlt oder ist nicht eindeutig')
        with archive.open(mapping_entry) as source:
            mapping_sha256 = hashlib.file_digest(source, 'sha256').hexdigest()
        video_hashes = {
            hashlib.sha256(archive.read(name)).hexdigest()
            for name in names if name.startswith('base/') and name.lower().endswith('.mp4')
        }
        missing = [item['file'] for item in manifest['formats'] if item['sha256'] not in video_hashes]
        if missing:
            raise ValueError('Intro im AAB fehlt oder wurde verändert: ' + ', '.join(missing))
    subprocess.run(['jarsigner', '-verify', str(bundle)], check=True)
    upload_fingerprint = verify_upload_certificate(bundle, signing['uploadCertificateSha256'])
    r8_archive_sha256 = verify_r8_artifacts(bundle.parent / 'R8-build-artifacts.tar.gz', mapping_sha256)
    baseline = json.loads((bundle.parent / 'EAS-VERSION-BASELINE.json').read_text())['versionCode']
    if not str(baseline).isdigit() or int(baseline) < 40 or identity['versionCode'] <= int(baseline):
        raise ValueError('AAB-Versionscode liegt nicht über der vor dem Build gelesenen EAS-Version')
    with bundle.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    (bundle.parent / 'SHA256SUMS.txt').write_text(f'{digest}  {bundle.name}\n')
    info = {
        'repository': os.environ.get('GITHUB_REPOSITORY'),
        'commit': os.environ.get('GITHUB_SHA'),
        'runId': os.environ.get('GITHUB_RUN_ID'),
        'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'builder': 'GitHub Actions / EAS local',
        'profile': 'healthos-full-aab',
        'file': bundle.name,
        'sha256': digest,
        'bytes': bundle.stat().st_size,
        'introVersion': manifest['version'],
        'verifiedIntroFormats': len(manifest['formats']),
        'verifiedNativeSurfaceMarkers': native_markers,
        'uploadCertificateSha256': upload_fingerprint,
        'r8ArtifactArchiveSha256': r8_archive_sha256,
        'r8MappingSha256': mapping_sha256,
        'r8MergedOptimizationsVerified': True,
        'previousEasVersionCode': int(baseline),
        **identity,
    }
    (bundle.parent / 'BUILD-INFO.json').write_text(json.dumps(info, indent=2) + '\n')
    print(f'AAB-Signatur und {len(manifest["formats"])} Introformate geprüft: {digest}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Aufruf: python3 scripts/verify-github-aab.py PFAD_ZUR_AAB')
    verify(Path(sys.argv[1]).resolve())
