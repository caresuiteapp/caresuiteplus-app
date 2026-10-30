import io
import struct
import unittest
import zipfile
from android_edge_to_edge_audit import retired_window_references, verify_edge_to_edge_archive


def dex(methods=(), fields=()):
    strings = sorted({b'V', *(owner for owner, name in (*methods, *fields)), *(name for owner, name in (*methods, *fields))})
    types = sorted({b'V', *(owner for owner, name in (*methods, *fields))}, key=strings.index)
    result = bytearray(112)
    result[:8] = b'dex\n039\0'
    struct.pack_into('<II', result, 36, 112, 0x12345678)
    sections = {}
    for key, items, size, header in [('strings', strings, 4, 56), ('types', types, 4, 64), ('protos', [None], 12, 72), ('fields', fields, 8, 80), ('methods', methods, 8, 88)]:
        offset = len(result) if items else 0
        struct.pack_into('<II', result, header, len(items), offset)
        sections[key] = offset
        result.extend(bytes(size * len(items)))
    data_offset = len(result)
    for index, value in enumerate(strings):
        assert len(value) < 128
        struct.pack_into('<I', result, sections['strings'] + index * 4, len(result))
        result.extend(bytes([len(value)]) + value + b'\0')
    for index, value in enumerate(types):
        struct.pack_into('<I', result, sections['types'] + index * 4, strings.index(value))
    struct.pack_into('<III', result, sections['protos'], strings.index(b'V'), types.index(b'V'), 0)
    for key, entries in [('fields', fields), ('methods', methods)]:
        for index, (owner, name) in enumerate(entries):
            struct.pack_into('<HHI', result, sections[key] + index * 8, types.index(owner), 0, strings.index(name))
    struct.pack_into('<I', result, 32, len(result))
    struct.pack_into('<II', result, 104, len(result) - data_offset, data_offset)
    return bytes(result)


class WindowApiAudit(unittest.TestCase):
    def test_all_reported_window_symbols_are_rejected(self):
        for name in [b'getStatusBarColor', b'getNavigationBarColor', b'setStatusBarColor', b'setNavigationBarColor']:
            with self.subTest(name=name):
                refs = retired_window_references(dex([(b'Landroid/view/Window;', name)]))
                self.assertEqual([r['name'] for r in refs], [name.decode()])

    def test_same_named_app_methods_are_not_framework_calls(self):
        self.assertEqual(retired_window_references(dex([(b'Lexample/Window;', b'setStatusBarColor')])), [])

    def test_unsupported_cutout_constant_references_are_rejected(self):
        for name in [b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT', b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES']:
            refs = retired_window_references(dex(fields=[(b'Landroid/view/WindowManager$LayoutParams;', name)]))
            self.assertEqual(refs[0]['kind'], 'fields')

    def test_modern_cutout_constants_and_retained_layout_field_are_allowed(self):
        fields = [(b'Landroid/view/WindowManager$LayoutParams;', name) for name in [b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS', b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER', b'layoutInDisplayCutoutMode']]
        self.assertEqual(retired_window_references(dex(fields=fields)), [])

    def test_truncated_or_corrupted_inputs_fail_closed(self):
        for data in [b'', dex()[:-1], b'bad\0' + dex()[4:]]:
            with self.assertRaises(ValueError): retired_window_references(data)

    def test_audit_includes_feature_dex_and_rejects_a_retired_dependency(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as z:
            z.writestr('base/dex/classes.dex', dex())
            z.writestr('feature/dex/classes2.dex', dex([(b'Landroid/view/Window;', b'setNavigationBarColor')]))
        with zipfile.ZipFile(source) as z:
            with self.assertRaisesRegex(ValueError, 'feature/dex/classes2.dex'): verify_edge_to_edge_archive(z)

    def test_packaged_clean_symbols_are_bound_to_each_dex_hash(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as z: z.writestr('base/dex/classes.dex', dex())
        with zipfile.ZipFile(source) as z:
            report = verify_edge_to_edge_archive(z)
            self.assertEqual(report['status'], 'passed')
            self.assertEqual(report['dexFiles'], 1)
            self.assertEqual(len(report['checks'][0]['sha256']), 64)

    def test_missing_dex_is_not_a_passing_audit(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w'): pass
        with zipfile.ZipFile(source) as z:
            with self.assertRaisesRegex(ValueError, 'Missing'): verify_edge_to_edge_archive(z)


if __name__ == '__main__': unittest.main()
