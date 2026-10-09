"""Manifest identity gate: raw/compiled AAPT2 fields and invalid release inputs."""
import importlib.util
from pathlib import Path
import unittest
import io
import tarfile
import tempfile

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


class ManifestGate(unittest.TestCase):
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
        data = b' '.join([b'native-administration-desktop', b'Neues Passwort speichern', b'Ohne Anmeldung ein Support-Ticket einreichen', b'Neo-Assistent', b'Google Workspace'])
        self.assertEqual(verify.verify_native_bundle(data), 5)

    def test_hermes_utf16_native_surface(self):
        data = b' '.join([b'native-administration-desktop', b'Neues Passwort speichern', b'Ohne Anmeldung ein Support-Ticket einreichen', 'Neo-Assistent öffnen'.encode('utf-16-le'), b'Google Workspace'])
        self.assertEqual(verify.verify_native_bundle(data), 5)
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


if __name__ == '__main__':
    unittest.main()
