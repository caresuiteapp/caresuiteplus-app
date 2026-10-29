"""Offline, bounded PFL_LNW XSD validation; only fixed errors leave on failure.

Uses the existing Python/lxml runtime. No network, filesystem entity lookup,
XInclude, stylesheets, schemaLocation hints, or unsigned alternate schema.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys

MANIFEST = '908ad0933309fc314ad854ede4805d0db3374007924b768b01cb77974536f114'
NS = 'http://www.gkv-datenaustausch.de/XMLSchema/PFL_LNW/2.2'
LIMIT = 8 * 1024 * 1024


class Rejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Rejected('MONTHLY_XML_' + code)


def run(etree):
    folder = Path(__file__).resolve().parent / 'pfl-schema' / '1.2.0'
    manifest = (folder / 'manifest.json').read_bytes()
    require(hashlib.sha256(manifest).hexdigest() == MANIFEST, 'SCHEMA_INTEGRITY')
    schemas = {}
    for name, sha in json.loads(manifest)['files'].items():
        require(name in ('PFL_LNW_2.2.0.xsd', 'PFL_basis_2.2.0.xsd'), 'SCHEMA_INTEGRITY')
        data = (folder / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == sha, 'SCHEMA_INTEGRITY')
        schemas['https://schemas.invalid/' + name] = data

    class Resolver(etree.Resolver):
        def resolve(self, url, public_id, context):
            require(url in schemas, 'SCHEMA_IMPORT')
            return self.resolve_string(schemas[url], context, base_url=url)

    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             recover=False, huge_tree=False, remove_blank_text=False)
    parser.resolvers.add(Resolver())
    url = 'https://schemas.invalid/PFL_LNW_2.2.0.xsd'
    schema = etree.XMLSchema(etree.fromstring(schemas[url], parser, base_url=url))
    # Raw XML over stdin, not command-line arguments, filenames or environment.
    raw = sys.stdin.buffer.read(LIMIT + 1)
    require(0 < len(raw) <= LIMIT, 'LIMIT')
    require(not raw.startswith(b'\xef\xbb\xbf'), 'ENCODING')
    decoded = raw.decode('utf-8', errors='strict')
    require('<!DOCTYPE' not in decoded and '<!ENTITY' not in decoded, 'DTD')
    declaration = re.match(r'<\?xml\s.*?\?>', decoded, re.DOTALL)
    if declaration:
        require(re.search(r'version\s*=\s*[\'"]1\.0[\'"]', declaration[0]) is not None, 'ENCODING')
        encoding = re.search(r'encoding\s*=\s*[\'"]([^\'"]+)[\'"]', declaration[0])
        require(encoding is None or encoding[1].upper() == 'UTF-8', 'ENCODING')
    root = etree.fromstring(raw, parser)
    tree = root.getroottree()
    require(not tree.docinfo.doctype and not tree.xpath('//processing-instruction()|//comment()'), 'PROFILE')
    require(root.tag == '{' + NS + '}Leistungsnachweis', 'PROFILE')
    for count, node in enumerate(root.iter(), 1):
        require(count <= 100000 and isinstance(node.tag, str) and len(list(node.iterancestors())) <= 12, 'LIMIT')
        require(not node.attrib and not (node.tail or '').strip(), 'PROFILE')
        require(len(node.text or '') <= (2796204 if node.tag == '{' + NS + '}Datei' else 1024), 'LIMIT')
        require(not len(node) or not (node.text or '').strip(), 'PROFILE')
    require(schema.validate(root), 'XSD')

    def one(node, name):
        found = node.findall('{' + NS + '}' + name)
        require(len(found) == 1, 'PROFILE')
        return found[0]

    def text(node, name):
        return one(node, name).text or ''

    data = one(root, 'Erbrachte_Leistungen')
    days = []
    for day in one(data, 'Leistungen'):
        date = text(day, 'Datum')
        visits = []
        for visit in day.findall('{' + NS + '}Einsatz'):
            lines = []
            for line in visit.findall('{' + NS + '}Einzelleistung'):
                quantity = line.find('{' + NS + '}Anzahl')
                lines.append({'code': text(line, 'Leistungsziffer'), 'description': text(line, 'Bezeichnung_der_Leistung'),
                              'employeeNumbers': [n.text or '' for n in line.findall('{' + NS + '}Beschaeftigtennummer')],
                              **({'quantity': quantity.text or ''} if quantity is not None else {'minutes': int(text(line, 'Tatsaechliche_Dauer'))})})
            visits.append({'sequence': int(text(visit, 'Lfd_Nummer')), 'startTime': text(visit, 'Uhrzeit_Beginn'), 'lines': lines})
        days.append({'date': date[:4] + '-' + date[4:6] + '-' + date[6:], 'visits': visits})
    signature = one(root, 'Unterschrift_Versicherter')
    kind = text(signature, 'Art_der_Unterschrift')
    require(kind in ('1', '3'), 'UNSUPPORTED_SIGNATURE')
    file = one(signature, 'Unterschrift')
    encoded = text(file, 'Datei')
    binary = base64.b64decode(encoded, validate=True)
    require(0 < len(binary) <= 2097152 and base64.b64encode(binary).decode() == encoded, 'BINARY')
    stamp = signature.find('{' + NS + '}Datum_Uhrzeit_der_Unterschrift')
    month = text(data, 'Abrechnungsmonat')
    document = {'proofId': text(root, 'Leistungsnachweis_ID'), 'providerIk': text(data, 'IK_Pflegedienst'),
                'month': month[:4] + '-' + month[4:], 'insuranceNumber': text(data, 'Versichertennummer'),
                'lastName': text(data, 'Name'), 'firstName': text(data, 'Vorname'),
                'serviceType': days[0]['visits'][0]['lines'][0]['code'][:2],
                # Preserve the spelling of the official element (one n in numer).
                'responsibleEmployeeNumber': text(data, 'Beschaeftigtennumer_verantwortliche_Fachkraft'), 'days': days,
                'signature': {'type': kind, 'fileType': text(file, 'Dateityp'), 'base64': encoded,
                              **({'signedLocalTime': stamp.text or ''} if stamp is not None else {})}}
    return {'document': document, 'sha256': hashlib.sha256(raw).hexdigest(), 'schemaSha256': MANIFEST}


try:
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    from lxml import etree
except Exception:
    print(json.dumps({'error': 'MONTHLY_XML_UNAVAILABLE'}))
    sys.exit(0)
try:
    print(json.dumps(run(etree), ensure_ascii=True, separators=(',', ':')))
except Rejected as error:
    print(json.dumps({'error': str(error)}))
except (FileNotFoundError, PermissionError):
    print(json.dumps({'error': 'MONTHLY_XML_SCHEMA_INTEGRITY'}))
except Exception:
    print(json.dumps({'error': 'MONTHLY_XML_REJECTED'}))
