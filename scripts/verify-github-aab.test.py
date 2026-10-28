"""Manifest identity gate: raw/compiled AAPT2 fields and invalid release inputs."""
import importlib.util
from pathlib import Path
import unittest
import io
import tarfile
import tempfile
import hashlib
import json
import struct
import zipfile

spec = importlib.util.spec_from_file_location('aab_verify', Path(__file__).with_name('verify-github-aab.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)


def field(number, value):
    if isinstance(value, int):
        return varint(number << 3) + varint(value)
    if isinstance(value, str):
        value = value.encode()
    return varint((number << 3) | 2) + varint(len(value)) + value


def manifest(compiled=False):
    android = 'http://schemas.android.com/apk/res/android'
    package = field(2, 'package') + field(3, 'app.caresuitehealthos')
    version = field(1, android) + field(2, 'versionName') + field(3, '0.4.0')
    code = field(1, android) + field(2, 'versionCode')
    code += field(6, field(7, field(6, 41))) if compiled else field(3, '41')
    return field(1, field(3, 'manifest') + field(4, package) + field(4, version) + field(4, code))


def dex_fixture(variants=None, names=None):
    """Small DEX table/class_data fixture; every class has a no-arg reference.

    Only the declared method bodies vary. This distinguishes surviving
    method_ids from the executable constructors required by reflection.
    """
    variants = variants or {}
    names = tuple(verify.STARTUP_CONSTRUCTORS if names is None else names)
    descriptors = {name: 'L' + name.replace('.', '/') + ';' for name in names}
    strings = sorted(set(['<init>', 'a', 'field', 'I', 'V', 'VI', 'Ljava/lang/Object;', *descriptors.values()]))
    string_index = {value: index for index, value in enumerate(strings)}
    types = sorted(['I', 'V', 'Ljava/lang/Object;', *descriptors.values()], key=string_index.get)
    type_index = {value: index for index, value in enumerate(types)}
    classes = sorted(names, key=lambda name: type_index[descriptors[name]])
    # Void/no arguments, void/one int argument, int/no arguments.
    protos = [(type_index['V'], False), (type_index['V'], True), (type_index['I'], False)]
    methods = []
    for name in classes:
        owner = type_index[descriptors[name]]
        methods.extend([(owner, '<init>', 0), (owner, '<init>', 1), (owner, '<init>', 2), (owner, 'a', 0)])
    methods.sort(key=lambda method: (method[0], string_index[method[1]], method[2]))
    method_index = {value: index for index, value in enumerate(methods)}
    fields = [(type_index[descriptors[name]], type_index['I'], string_index['field']) for name in classes]
    field_index = {name: index for index, name in enumerate(classes)}
    counts = [len(strings), len(types), len(protos), len(fields), len(methods), len(classes)]
    widths = [4, 4, 12, 8, 8, 32]
    offsets = []
    cursor = 112
    for count, width in zip(counts, widths):
        offsets.append(cursor if count else 0)
        cursor += count * width
    data_off = cursor
    data = bytearray(cursor)

    def append(value, align=1):
        data.extend(b'\0' * (-len(data) % align))
        offset = len(data)
        data.extend(value)
        return offset

    for index, value in enumerate(strings):
        offset = append(varint(len(value)) + value.encode() + b'\0')
        struct.pack_into('<I', data, offsets[0] + index * 4, offset)
    for index, value in enumerate(types):
        struct.pack_into('<I', data, offsets[1] + index * 4, string_index[value])
    parameters = append(struct.pack('<IH', 1, type_index['I']), 4)
    for index, (returns, parameter) in enumerate(protos):
        struct.pack_into('<III', data, offsets[2] + index * 12, string_index['VI' if parameter else types[returns]], returns, parameters if parameter else 0)
    for index, values in enumerate(fields):
        struct.pack_into('<HHI', data, offsets[3] + index * 8, *values)
    for index, (owner, name, proto) in enumerate(methods):
        struct.pack_into('<HHI', data, offsets[4] + index * 8, owner, proto, string_index[name])
    for index, name in enumerate(classes):
        variant = variants.get(name, 'valid')
        owner = type_index[descriptors[name]]
        method_name = 'a' if variant == 'not_constructor' else '<init>'
        proto = 1 if variant == 'parameters' else 2 if variant == 'wrong_return' else 0
        method = method_index[(owner, method_name, proto)]
        flags = 0x10002 if variant == 'private' else 1 if variant == 'not_constructor' else 0x10001
        code = 0 if variant == 'no_code' else append(struct.pack('<HHHHIIH', 1, 1, 0, 0, 0, 1_000_000 if variant == 'bad_code' else 1, 0x000e), 4)
        direct = 0 if variant in ('reference', 'virtual') else 1
        virtual = 1 if variant == 'virtual' else 0
        content = varint(1) + varint(0) + varint(direct) + varint(virtual)
        content += varint(field_index[name]) + varint(1)
        if direct or virtual:
            content += varint(method) + varint(flags) + varint(code)
        class_data = append(content)
        class_flags = 0x10 if variant == 'class_private' else 0x11
        struct.pack_into('<8I', data, offsets[5] + index * 32, owner, class_flags, type_index['Ljava/lang/Object;'], 0, 0xffffffff, 0, class_data, 0)
    append(b'', 4)
    data[:8] = b'dex\n037\0'
    struct.pack_into('<III', data, 32, len(data), 112, 0x12345678)
    for index, (count, offset) in enumerate(zip(counts, offsets)):
        struct.pack_into('<II', data, 56 + index * 8, count, offset)
    struct.pack_into('<II', data, 104, len(data) - data_off, data_off)
    return bytes(data)


def startup_archive(dexes):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        for name, dex in dexes:
            archive.writestr(name, dex)
    data.seek(0)
    return zipfile.ZipFile(data)


class StartupConstructorGate(unittest.TestCase):
    def test_declared_public_constructors_across_actual_dex_tables(self):
        first, *rest = verify.STARTUP_CONSTRUCTORS
        with startup_archive([('base/dex/classes.dex', dex_fixture(names=[first])), ('base/dex/classes2.dex', dex_fixture(names=rest))]) as archive:
            self.assertEqual(verify.verify_startup_constructors(archive), 3)

    def test_method_references_do_not_prove_constructor_definitions(self):
        # Reproduce code51: retained class headers and no-arg method references,
        # but no declared constructor in class_data.
        variants = {name: 'reference' for name in verify.STARTUP_CONSTRUCTORS}
        with startup_archive([('base/dex/classes.dex', dex_fixture(variants))]) as archive:
            with self.assertRaises(ValueError) as caught:
                verify.verify_startup_constructors(archive)
        for name in verify.STARTUP_CONSTRUCTORS:
            self.assertIn(name + '.<init>()V', str(caught.exception))

    def test_constructor_overloads_visibility_flags_and_code_are_required(self):
        name = verify.STARTUP_CONSTRUCTORS[0]
        for variant in ['parameters', 'private', 'no_code', 'class_private', 'wrong_return', 'not_constructor']:
            with self.subTest(variant=variant), startup_archive([('base/dex/classes.dex', dex_fixture({name: variant}))]) as archive:
                with self.assertRaisesRegex(ValueError, 'Öffentliche Startkonstruktoren fehlen'):
                    verify.verify_startup_constructors(archive)
        for variant in ['virtual', 'bad_code']:
            with self.subTest(variant=variant), self.assertRaises(ValueError):
                verify.read_dex_startup_constructors(dex_fixture({name: variant}))

    def test_missing_classes_and_duplicate_definitions_fail(self):
        names = verify.STARTUP_CONSTRUCTORS
        for dexes in [[], [('base/dex/classes.dex', dex_fixture(names=names[:1]))], [('base/dex/classes.dex', dex_fixture()), ('base/dex/classes2.dex', dex_fixture())]]:
            with self.subTest(files=len(dexes)), startup_archive(dexes) as archive, self.assertRaises(ValueError):
                verify.verify_startup_constructors(archive)
        data = bytearray(dex_fixture())
        class_defs = struct.unpack_from('<I', data, 100)[0]
        data[class_defs + 32:class_defs + 36] = data[class_defs:class_defs + 4]
        with self.assertRaisesRegex(ValueError, 'Doppelte DEX-Startklasse'):
            verify.read_dex_startup_constructors(data)

    def test_truncated_unsupported_and_out_of_bounds_dex_fail(self):
        valid = dex_fixture()
        for data in [b'', valid[:111], valid[:-1], b'dex\n041\0' + valid[8:]]:
            with self.subTest(length=len(data)), self.assertRaises(ValueError):
                verify.read_dex_startup_constructors(data)
        for offset, value in [(40, 0x78563412), (60, len(valid)), (96, 0xffffffff), (108, 16)]:
            data = bytearray(valid)
            struct.pack_into('<I', data, offset, value)
            with self.subTest(header_offset=offset), self.assertRaises(ValueError):
                verify.read_dex_startup_constructors(data)
        data = bytearray(valid)
        class_defs = struct.unpack_from('<I', data, 100)[0]
        class_data = struct.unpack_from('<I', data, class_defs + 24)[0]
        data[class_data:class_data + 5] = b'\xff' * 5
        with self.assertRaisesRegex(ValueError, 'ULEB128'):
            verify.read_dex_startup_constructors(data)


class ManifestGate(unittest.TestCase):
    def test_signed_agp_metadata_rejects_legacy_and_ambiguous_builds(self):
        self.assertEqual(verify.verify_agp_metadata(b'appMetadataVersion=1.1\nandroidGradlePluginVersion=9.0.1\n'), '9.0.1')
        for text in [b'', b'androidGradlePluginVersion=8.12.0\n', b'androidGradlePluginVersion=9.0.1\nandroidGradlePluginVersion=8.12.0\n']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                verify.verify_agp_metadata(text)

    def test_signed_r8_compiler_rejects_old_mapping(self):
        self.assertEqual(verify.verify_r8_compiler(b'# compiler: R8\n# compiler_version: 9.0.76\n'), '9.0.76')
        self.assertEqual(verify.verify_r8_compiler(b'# compiler_version: 9.0.76\n# Unicode prefix: \xc3'), '9.0.76')
        for text in [b'', b'# compiler_version: 8.12.14\n', b'# compiler_version: 9.0.76\n# compiler_version: 8.12.14\n']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                verify.verify_r8_compiler(text)

    def test_raw_identity(self):
        identity = verify.read_manifest_identity(manifest())
        self.assertEqual(identity, {'applicationId': 'app.caresuitehealthos', 'versionName': '0.4.0', 'versionCode': 41})
        verify.verify_identity(identity, '0.4.0')

    def test_remote_compiled_code(self):
        self.assertEqual(verify.read_manifest_identity(manifest(True))['versionCode'], 41)

    def test_invalid_identity(self):
        identity = verify.read_manifest_identity(manifest())
        for key, value in [('applicationId', 'other.app'), ('versionName', '0.3.6'), ('versionCode', 38), ('versionCode', 39), ('versionCode', 40), ('versionCode', 0)]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                verify.verify_identity({**identity, key: value}, '0.4.0')

    def test_truncated_manifest(self):
        for data in [b'', b'\x80', manifest()[:-1]]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                verify.read_manifest_identity(data)

    def test_missing_native_surfaces(self):
        with self.assertRaises(ValueError):
            verify.verify_native_bundle(b'portal-only legacy bundle')
        data = b' '.join([b'native-administration-desktop', b'Neues Passwort speichern', b'Ohne Anmeldung ein Support-Ticket einreichen', b'Neo-Assistent', b'Google Workspace', b'Notiz speichern', b'Alle Mitarbeitenden'])
        self.assertEqual(verify.verify_native_bundle(data), 7)

    def test_hermes_utf16_native_surface(self):
        data = b' '.join([b'native-administration-desktop', b'Neues Passwort speichern', b'Ohne Anmeldung ein Support-Ticket einreichen', 'Neo-Assistent öffnen'.encode('utf-16-le'), b'Google Workspace', b'Notiz speichern', b'Alle Mitarbeitenden'])
        self.assertEqual(verify.verify_native_bundle(data), 7)
        with self.assertRaises(ValueError):
            verify.verify_native_bundle(data.replace('Neo-Assistent'.encode('utf-16-le'), 'Web-Assistent'.encode('utf-16-le')))

    def test_actual_r8_merged_configuration(self):
        def archive_file(path, configuration, mapping='# compiler: R8\n# compiler_version: 8.12\na.A -> b:\n'):
            with tarfile.open(path, 'w:gz') as archive:
                for name, text in [('mapping.txt', mapping), ('configuration.txt', configuration)]:
                    data = text.encode()
                    info = tarfile.TarInfo('release/' + name)
                    info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'R8-build-artifacts.tar.gz'
            with self.assertRaises(ValueError):
                verify.verify_r8_artifacts(path)
            archive_file(path, '-keepattributes SourceFile,LineNumberTable\n-keep class * implements com.facebook.react.bridge.NativeModule { *; }\n')
            self.assertRegex(verify.verify_r8_artifacts(path), r'^[a-f0-9]{64}$')
            for flag in ['dontoptimize', 'dontshrink', 'dontobfuscate']:
                with self.subTest(flag=flag), self.assertRaises(ValueError):
                    archive_file(path, '-' + flag + '\n')
                    verify.verify_r8_artifacts(path)
            archive_file(path, '-keepattributes SourceFile\n', '# compiler: ProGuard\n')
            with self.assertRaises(ValueError):
                verify.verify_r8_artifacts(path)


    def test_full_mapping_over_old_50_mib_limit(self):
        # Reproduce the release's 125 MB mapping without holding it in RAM.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mapping = root / 'mapping.txt'
            digest = hashlib.sha256()
            with mapping.open('wb') as out:
                header = b'# compiler: R8\n# compiler_version: 8.12\n'
                out.write(header)
                digest.update(header)
                chunk = b'# native release mapping\n' * 4096
                for _ in range(1300):
                    out.write(chunk)
                    digest.update(chunk)
            self.assertGreater(mapping.stat().st_size, 125 * 1000 * 1000)
            path = root / 'R8-build-artifacts.tar.gz'
            configuration = b'-keepattributes SourceFile,LineNumberTable\n'
            with tarfile.open(path, 'w:gz') as archive:
                archive.add(mapping, arcname='release/mapping.txt')
                info = tarfile.TarInfo('release/configuration.txt')
                info.size = len(configuration)
                archive.addfile(info, io.BytesIO(configuration))
            self.assertRegex(verify.verify_r8_artifacts(path, digest.hexdigest()), r'^[a-f0-9]{64}$')
            with self.assertRaisesRegex(ValueError, 'signierten Mapping'):
                verify.verify_r8_artifacts(path, '0' * 64)

    def test_mapping_archive_uniqueness_and_missing_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'R8.tar.gz'
            def write(names):
                with tarfile.open(path, 'w:gz') as archive:
                    for name, data in names:
                        info = tarfile.TarInfo(name)
                        info.size = len(data)
                        archive.addfile(info, io.BytesIO(data))
            mapping = b'# compiler: R8\n'
            configuration = b'-keepattributes SourceFile\n'
            write([('release/mapping.txt', mapping)])
            with self.assertRaisesRegex(ValueError, 'configuration.txt.*gefunden: 0'):
                verify.verify_r8_artifacts(path)
            write([('a/mapping.txt', mapping), ('b/mapping.txt', mapping), ('configuration.txt', configuration)])
            with self.assertRaisesRegex(ValueError, 'mapping.txt.*gefunden: 2'):
                verify.verify_r8_artifacts(path)
            write([('mapping.txt', mapping + b'\xff'), ('configuration.txt', configuration)])
            with self.assertRaises(UnicodeDecodeError):
                verify.verify_r8_artifacts(path)

    def test_full_android_profile_collects_mapping_and_configuration(self):
        profile = json.loads((Path(__file__).resolve().parent.parent / 'eas.json').read_text())['build']['healthos-full-aab']
        paths = profile['android']['buildArtifactPaths']
        self.assertIn('android/app/build/outputs/mapping/release/*', paths)
        self.assertEqual(paths, profile['buildArtifactPaths'])
        self.assertFalse(any('aab' in item or 'apk' in item for item in paths))


if __name__ == '__main__':
    unittest.main()
