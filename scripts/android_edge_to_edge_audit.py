"""Inspect framework symbols in the final DEX files, after dependency rewriting/R8."""
import hashlib
import struct

WINDOW = b'Landroid/view/Window;'
PARAMS = b'Landroid/view/WindowManager$LayoutParams;'
RETIRED_METHODS = {b'getStatusBarColor', b'setStatusBarColor', b'setNavigationBarColor'}
RETIRED_CONSTANTS = {b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT', b'LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES'}


def retired_window_references(data):
    def bounds(offset, size, alignment=1):
        if offset < 0 or size < 0 or offset % alignment or offset + size > len(data):
            raise ValueError('Invalid DEX range in edge-to-edge audit')

    def u32(offset):
        bounds(offset, 4)
        return struct.unpack_from('<I', data, offset)[0]

    bounds(0, 112)
    if data[:8] not in [b'dex\n' + version + b'\0' for version in (b'035', b'037', b'038', b'039', b'040')]:
        raise ValueError('Unsupported DEX format in edge-to-edge audit')
    if u32(32) != len(data) or u32(36) != 112 or u32(40) != 0x12345678:
        raise ValueError('Invalid DEX header in edge-to-edge audit')
    data_size, data_off = u32(104), u32(108)
    if not data_size or data_off < 112 or data_off + data_size != len(data):
        raise ValueError('Invalid DEX data section in edge-to-edge audit')

    tables = {}
    for name, header, width in [('strings', 56, 4), ('types', 64, 4), ('fields', 80, 8), ('methods', 88, 8)]:
        count, offset = u32(header), u32(header + 4)
        bounds(offset, count * width, 4)
        if count > (1_000_000 if name == 'strings' else 65535) or (count and (offset < 112 or offset + count * width > data_off)) or (not count and offset):
            raise ValueError('Invalid DEX symbol table in edge-to-edge audit: ' + name)
        tables[name] = (count, offset, width)

    def item(name, index):
        count, offset, width = tables[name]
        if not 0 <= index < count:
            raise ValueError('Invalid DEX symbol index in edge-to-edge audit')
        return offset + index * width

    strings = {}
    def string(index):
        if index not in strings:
            offset = u32(item('strings', index))
            if offset < data_off:
                raise ValueError('DEX string lies outside data section')
            length = 0
            for shift in range(0, 35, 7):
                bounds(offset, 1)
                byte = data[offset]
                offset += 1
                if shift == 28 and byte > 15:
                    raise ValueError('Invalid DEX string length')
                length |= (byte & 127) << shift
                if byte < 128:
                    break
            else:
                raise ValueError('Invalid DEX string length')
            if length > 1_000_000:
                raise ValueError('DEX string exceeds audit limit')
            end = data.find(b'\0', offset, min(len(data), offset + length * 3 + 1))
            if end < offset or end - offset < length:
                raise ValueError('Incomplete DEX string')
            strings[index] = data[offset:end]
        return strings[index]

    def descriptor(index):
        return string(u32(item('types', index)))

    found = []
    for kind, owner, retired in [('methods', WINDOW, RETIRED_METHODS), ('fields', PARAMS, RETIRED_CONSTANTS)]:
        for index in range(tables[kind][0]):
            offset = item(kind, index)
            class_index = struct.unpack_from('<H', data, offset)[0]
            name_index = u32(offset + 4)
            if descriptor(class_index) == owner and string(name_index) in retired:
                found.append({'kind': kind, 'owner': owner.decode('ascii'), 'name': string(name_index).decode('ascii')})
    return found


def verify_edge_to_edge_archive(archive):
    entries = sorted(name for name in archive.namelist() if '/dex/' in name and name.endswith('.dex'))
    if 'base/dex/classes.dex' not in entries or len(entries) > 256:
        raise ValueError('Missing or unexpected packaged DEX files')
    checks, retired = [], []
    for name in entries:
        if archive.getinfo(name).file_size > 128 * 1024 * 1024:
            raise ValueError('DEX exceeds edge-to-edge audit limit')
        data = archive.read(name)
        references = retired_window_references(data)
        checks.append({'entry': name, 'sha256': hashlib.sha256(data).hexdigest(), 'retiredReferences': references})
        retired.extend({'entry': name, **reference} for reference in references)
    if retired:
        raise ValueError('Retired Android window API/constant remains in the AAB: ' + str(retired))
    return {'status': 'passed', 'dexFiles': len(entries), 'retiredWindowMethods': 0, 'retiredCutoutConstants': 0, 'checks': checks,
            'cutoutAssignmentPolicy': 'ALL-scope pre-R8 ASM rewrite; ALWAYS on API 30+, NEVER on API 28–29; bridge excluded from rewriting'}
