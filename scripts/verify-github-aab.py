#!/usr/bin/env python3
"""Check the downloadable bundle, including all six approved intro videos."""
import hashlib
import codecs
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from android_edge_to_edge_audit import verify_edge_to_edge_archive


def verify_packaged_icons(archive, root, output_directory):
    pattern = re.compile(r'^base/res/(?:mipmap|drawable)-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)(?:-v4)?/(?:ic_launcher(?:_round|_foreground|_background|_monochrome)?|notification_icon|splashscreen_logo)\.(?:png|webp)$')
    with tempfile.TemporaryDirectory(prefix='caresuite-icons-') as directory:
        for name in archive.namelist():
            if pattern.fullmatch(name):
                target = Path(directory) / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))
        result = subprocess.run(['node', str(root / 'scripts/verify-android-app-icons.mjs'), '--resources', directory, str(output_directory)], check=True, capture_output=True, text=True)
        return json.loads(result.stdout)


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
    expected = ['native-administration-desktop', 'Neues Passwort speichern', 'Ohne Anmeldung ein Support-Ticket einreichen', 'Neo-Assistent', 'Google Workspace', 'Notiz speichern', 'Alle Mitarbeitenden']
    # Hermes stores strings containing umlauts as UTF-16, including their ASCII
    # prefixes. The bundle is binary; both encodings must be checked directly.
    missing = [marker for marker in expected if marker.encode('utf-8') not in data and marker.encode('utf-16-le') not in data]
    if missing:
        raise ValueError('Vollständige native App-Oberflächen fehlen im gebauten AAB: ' + ', '.join(missing))
    return len(expected)


STARTUP_CONSTRUCTORS = (
    'androidx.work.impl.WorkDatabase_Impl',
    'androidx.work.OverwritingInputMerger',
    'androidx.work.ArrayCreatingInputMerger',
)


def read_dex_startup_constructors(data):
    """Inspect declared constructors, not references in method_ids or mapping.

    Focused reader for the standard little-endian DEX 035/037-040 layout:
    https://source.android.com/docs/core/runtime/dex-format
    It checks the tables/class_data/code bounds used here, not VM bytecode.
    """
    def bounds(offset, size, alignment=1):
        if offset < 0 or size < 0 or offset % alignment or offset + size > len(data):
            raise ValueError('Ungültiger oder unvollständiger DEX-Bereich')

    def uint(offset):
        bounds(offset, 4)
        return struct.unpack_from('<I', data, offset)[0]

    def leb(offset):
        result = 0
        for shift in range(0, 35, 7):
            bounds(offset, 1)
            byte = data[offset]
            offset += 1
            if shift == 28 and byte > 15:
                raise ValueError('Ungültiger DEX-ULEB128-Wert')
            result |= (byte & 127) << shift
            if byte < 128:
                return result, offset
        raise ValueError('Ungültiger DEX-ULEB128-Wert')

    bounds(0, 112)
    if data[:8] not in [b'dex\n' + version + b'\0' for version in (b'035', b'037', b'038', b'039', b'040')]:
        raise ValueError('Nicht unterstütztes DEX-Format')
    if uint(32) != len(data) or uint(36) != 112 or uint(40) != 0x12345678:
        raise ValueError('Ungültiger oder unvollständiger DEX-Header')
    data_size, data_off = uint(104), uint(108)
    bounds(data_off, data_size, 4)
    if not data_size or data_off < 112 or data_off + data_size != len(data):
        raise ValueError('Ungültiger DEX-Datenbereich')

    def data_bounds(offset, size, alignment=1):
        bounds(offset, size, alignment)
        if offset < data_off:
            raise ValueError('DEX-Datenverweis liegt außerhalb des Datenbereichs')

    tables = {}
    for name, header, width in [('strings', 56, 4), ('types', 64, 4), ('protos', 72, 12), ('fields', 80, 8), ('methods', 88, 8), ('classes', 96, 32)]:
        count, offset = uint(header), uint(header + 4)
        bounds(offset, count * width, 4)
        if (count and (offset < 112 or offset + count * width > data_off)) or (not count and offset):
            raise ValueError('Ungültige DEX-Tabelle: ' + name)
        if count > (1_000_000 if name == 'strings' else 65535):
            raise ValueError('DEX-Tabelle überschreitet die Prüfgrenze: ' + name)
        tables[name] = (count, offset, width)

    def item(name, index):
        count, offset, width = tables[name]
        if not 0 <= index < count:
            raise ValueError('Ungültiger DEX-Index: ' + name)
        return offset + index * width

    strings = {}
    def string(index):
        if index not in strings:
            offset = uint(item('strings', index))
            data_bounds(offset, 1)
            length, start = leb(offset)
            # Keep MUTF-8 as bytes: the names inspected here are ASCII. Other
            # class names may contain valid MUTF-8 surrogate encodings.
            if length > 1_000_000:
                raise ValueError('DEX-String überschreitet die Prüfgrenze')
            end = data.find(b'\0', start, min(len(data), start + length * 3 + 1))
            if end < start or end - start < length:
                raise ValueError('Unvollständiger DEX-String')
            strings[index] = bytes(data[start:end])
        return strings[index]

    def descriptor(index):
        return string(uint(item('types', index)))

    def no_arg_void(proto_index):
        offset = item('protos', proto_index)
        returns_void = descriptor(uint(offset + 4)) == b'V'
        parameters = uint(offset + 8)
        if not parameters:
            return returns_void
        data_bounds(parameters, 4, 4)
        size = uint(parameters)
        data_bounds(parameters + 4, size * 2)
        return returns_void and size == 0

    expected = {('L' + name.replace('.', '/') + ';').encode(): name for name in STARTUP_CONSTRUCTORS}
    found = {}
    for index in range(tables['classes'][0]):
        offset = item('classes', index)
        class_index, class_flags = uint(offset), uint(offset + 4)
        name = expected.get(descriptor(class_index))
        if name is None:
            continue
        if name in found:
            raise ValueError('Doppelte DEX-Startklasse: ' + name)
        found[name] = False
        class_data = uint(offset + 24)
        if not class_data:
            continue
        data_bounds(class_data, 1)
        counts = []
        for _ in range(4):
            count, class_data = leb(class_data)
            counts.append(count)
        if max(counts[:2]) > tables['fields'][0] or max(counts[2:]) > tables['methods'][0]:
            raise ValueError('Ungültige DEX-Klassenanzahl: ' + name)
        for count in counts[:2]:
            field_index = 0
            for position in range(count):
                difference, class_data = leb(class_data)
                _, class_data = leb(class_data)
                if position and not difference:
                    raise ValueError('Doppeltes DEX-Feld: ' + name)
                field_index += difference
                field = item('fields', field_index)
                if struct.unpack_from('<H', data, field)[0] != class_index:
                    raise ValueError('DEX-Feld gehört zu einer anderen Klasse')
        declared = set()
        constructor_seen = False
        for direct, count in [(True, counts[2]), (False, counts[3])]:
            method_index = 0
            for _ in range(count):
                difference, class_data = leb(class_data)
                flags, class_data = leb(class_data)
                code, class_data = leb(class_data)
                method_index += difference
                if method_index in declared:
                    raise ValueError('Doppelte DEX-Methode: ' + name)
                declared.add(method_index)
                owner, proto, method_name = struct.unpack_from('<HHI', data, item('methods', method_index))
                if owner != class_index:
                    raise ValueError('DEX-Methode gehört zu einer anderen Klasse')
                if string(method_name) != b'<init>' or not no_arg_void(proto):
                    continue
                if not direct or constructor_seen:
                    raise ValueError('Ungültiger oder doppelter DEX-Konstruktor: ' + name)
                constructor_seen = True
                if class_flags & 1 and not class_flags & 0x600 and flags & 7 == 1 and flags & 0x10000 and not flags & 0x508 and code:
                    data_bounds(code, 16, 4)
                    registers, incoming, _, tries, _, instructions = struct.unpack_from('<HHHHII', data, code)
                    data_bounds(code + 16, instructions * 2)
                    if tries:
                        data_bounds(code + 16 + instructions * 2 + (2 if instructions % 2 else 0), tries * 8)
                    if registers < 1 or incoming != 1 or not instructions:
                        raise ValueError('DEX-Konstruktor enthält keinen gültigen Code: ' + name)
                    found[name] = True
    return found


def verify_startup_constructors(archive):
    names = [name for name in archive.namelist() if re.fullmatch(r'base/dex/classes(?:[2-9]|[1-9][0-9]+)?\.dex', name)]
    if not names or len(names) > 32 or len(set(names)) != len(names):
        raise ValueError('Die DEX-Dateien der AAB fehlen oder sind nicht eindeutig')
    found = {}
    total = 0
    for name in names:
        size = archive.getinfo(name).file_size
        total += size
        if not 0 < size <= 128 * 1024 * 1024 or total > 256 * 1024 * 1024:
            raise ValueError('DEX-Dateien überschreiten die Prüfgrenze')
        for class_name, constructor in read_dex_startup_constructors(archive.read(name)).items():
            if class_name in found:
                raise ValueError('Doppelte DEX-Startklasse: ' + class_name)
            found[class_name] = constructor
    missing = [name + '.<init>()V' for name in STARTUP_CONSTRUCTORS if not found.get(name)]
    if missing:
        raise ValueError('Öffentliche Startkonstruktoren fehlen im tatsächlichen DEX: ' + ', '.join(missing))
    return len(STARTUP_CONSTRUCTORS)


def verify_agp_metadata(data):
    # Inspect the signed bundle's metadata, not the configured Gradle wrapper.
    versions = re.findall(r'^androidGradlePluginVersion=(\S+)\s*$', data.decode('utf-8'), re.M)
    if versions != ['9.0.1']:
        raise ValueError('Die signierte AAB wurde nicht mit dem freigegebenen Android-Gradle-Plugin 9.0.1 gebaut')
    return versions[0]


def verify_r8_compiler(header):
    # This is a bounded prefix and may end inside a Unicode class name. Full
    # mapping UTF-8 validity is checked incrementally in verify_r8_artifacts.
    versions = re.findall(r'^#\s*compiler_version:\s*(\d+\.\d+(?:\.\d+)?)\s*$', header.decode('utf-8', errors='replace'), re.M)
    if len(versions) != 1 or int(versions[0].split('.')[0]) < 9:
        raise ValueError('Das signierte Mapping stammt nicht aus R8 9 oder neuer')
    return versions[0]


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
        icon_report = verify_packaged_icons(archive, root, bundle.parent)
        names = archive.namelist()
        if 'BundleConfig.pb' not in names or 'base/manifest/AndroidManifest.xml' not in names:
            raise ValueError('Keine vollständige Android-App-Bundle-Struktur')
        if not any(re.fullmatch(r'META-INF/[^/]+\.(RSA|DSA|EC)', name, re.I) for name in names):
            raise ValueError('AAB enthält keine Upload-Signatur')
        identity = read_manifest_identity(archive.read('base/manifest/AndroidManifest.xml'))
        verify_identity(identity, expected_version)
        agp_entry = 'BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties'
        if names.count(agp_entry) != 1:
            raise ValueError('Der Android-Gradle-Plugin-Nachweis in der signierten AAB fehlt oder ist nicht eindeutig')
        agp_version = verify_agp_metadata(archive.read(agp_entry))
        native_bundles = [name for name in names if name.startswith('base/assets/') and name.endswith('.bundle')]
        if len(native_bundles) != 1:
            raise ValueError('Genau ein nativer JavaScript/Hermes-Bundle erwartet')
        native_markers = verify_native_bundle(archive.read(native_bundles[0]))
        startup_constructors = verify_startup_constructors(archive)
        edge_to_edge = verify_edge_to_edge_archive(archive)
        mapping_entry = 'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map'
        if names.count(mapping_entry) != 1:
            raise ValueError('Das signierte R8-Mapping im AAB fehlt oder ist nicht eindeutig')
        with archive.open(mapping_entry) as source:
            header = source.read(65536)
            r8_version = verify_r8_compiler(header)
            mapping_digest = hashlib.sha256(header)
            while chunk := source.read(256 * 1024):
                mapping_digest.update(chunk)
            mapping_sha256 = mapping_digest.hexdigest()
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
        'verifiedStartupConstructors': startup_constructors,
        'verifiedEdgeToEdge': edge_to_edge,
        'verifiedIconResources': len(icon_report['resources']),
        'iconSourceSha256': icon_report['sourceSha256'],
        'uploadCertificateSha256': upload_fingerprint,
        'r8ArtifactArchiveSha256': r8_archive_sha256,
        'r8MappingSha256': mapping_sha256,
        'r8MergedOptimizationsVerified': True,
        'androidGradlePluginVersion': agp_version,
        'r8CompilerVersion': r8_version,
        'previousEasVersionCode': int(baseline),
        **identity,
    }
    (bundle.parent / 'BUILD-INFO.json').write_text(json.dumps(info, indent=2) + '\n')
    (bundle.parent / 'EDGE-TO-EDGE-VERIFICATION.json').write_text(json.dumps(edge_to_edge, indent=2) + '\n')
    print(f'AAB-Signatur und {len(manifest["formats"])} Introformate geprüft: {digest}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Aufruf: python3 scripts/verify-github-aab.py PFAD_ZUR_AAB')
    verify(Path(sys.argv[1]).resolve())

