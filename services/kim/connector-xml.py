"""Bounded SOAP 1.1 / CertificateService 6.0.2 worker using pinned official XSDs.

Only fixed errors and bounded structured data leave this process. No network,
external entities, runtime WSDL lookup, SOAP encoding or executable transforms.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys

SOAP = 'http://schemas.xmlsoap.org/soap/envelope/'
CERT = 'http://ws.gematik.de/conn/CertificateService/v6.0'
COMMON = 'http://ws.gematik.de/conn/CertificateServiceCommon/v2.0'
CONN = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0'
ERROR = 'http://ws.gematik.de/tel/error/v2.0'
MANIFEST = '31c5701606f001ece88cd2a5110e05b4293d7f3e054359c367df73d6259cca80'
NS = {'s': SOAP, 'c': CERT, 'cc': COMMON, 'n': CONN, 'e': ERROR}


class Rejected(Exception):
    pass


def require(ok, code='XML_PROFILE'):
    if not ok:
        raise Rejected('KIM_CONNECTOR_' + code)


def one(node, path):
    found = node.findall(path, NS)
    require(len(found) == 1)
    return found[0]


def text(node, path):
    child = one(node, path)
    require(len(child) == 0 and not child.attrib)
    return child.text or ''


def binary(value, maximum):
    require(isinstance(value, str) and len(value) <= maximum * 2, 'XML_LIMIT')
    clean = re.sub(r'[\t\r\n ]', '', value)
    data = base64.b64decode(clean, validate=True)
    require(0 < len(data) <= maximum and base64.b64encode(data).decode() == clean, 'XML_PROFILE')
    return data


def remote_errors(node):
    errors = node.findall('.//e:Error/e:Trace', NS)
    require(len(errors) <= 32, 'XML_LIMIT')
    values = [int(text(n, 'e:Code')) for n in errors]
    require(all(0 <= value <= 2147483647 for value in values))
    return values  # Never include ErrorText, Detail, MessageID, Instance or LogReference.


def run(etree):
    folder = Path(__file__).resolve().parent / 'connector-schema'
    manifest = (folder / 'manifest.json').read_bytes()
    require(hashlib.sha256(manifest).hexdigest() == MANIFEST, 'SCHEMA_INTEGRITY')
    schemas = {}
    for name, fingerprint in json.loads(manifest)['files'].items():
        require(re.fullmatch(r'(?:conn|ext|tel/error)/[A-Za-z0-9_.-]+\.(?:xsd|wsdl)|LICENSE-gematik\.txt', name) is not None, 'SCHEMA_INTEGRITY')
        data = (folder / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == fingerprint, 'SCHEMA_INTEGRITY')
        schemas['https://schemas.invalid/' + name] = data

    class Resolver(etree.Resolver):
        def resolve(self, url, public_id, context):
            require(url in schemas, 'SCHEMA_IMPORT')
            return self.resolve_string(schemas[url], context, base_url=url)

    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             recover=False, huge_tree=False, remove_blank_text=False)
    parser.resolvers.add(Resolver())
    url = 'https://schemas.invalid/conn/CertificateService_v6_0_2.xsd'
    schema = etree.XMLSchema(etree.fromstring(schemas[url], parser, base_url=url))
    raw_input = sys.stdin.buffer.read(600001)
    require(0 < len(raw_input) <= 600000, 'XML_LIMIT')
    args = json.loads(raw_input)
    require(args.get('operation') in ('ReadCardCertificate', 'VerifyCertificate'))
    require(args.get('mode') in ('request', 'response'))
    raw = binary(args['xml'], 262144)
    decoded = raw.decode('utf-8-sig', errors='strict')
    require('<!DOCTYPE' not in decoded and '<!ENTITY' not in decoded, 'XML_DTD')
    declaration = re.match(r'<\?xml\s.*?\?>', decoded, re.DOTALL)
    if declaration:
        encoding = re.search(r'encoding\s*=\s*[\'\"]([^\'\"]+)[\'\"]', declaration[0])
        require(encoding is None or encoding[1].upper() == 'UTF-8')
    root = etree.fromstring(raw, parser)
    tree = root.getroottree()
    require(not tree.docinfo.doctype and not tree.xpath('//processing-instruction()|//comment()'))
    nodes = list(root.iter())
    require(len(nodes) <= 2048, 'XML_LIMIT')
    for node in nodes:
        require(isinstance(node.tag, str) and len(list(node.iterancestors())) <= 24, 'XML_LIMIT')
        require(len(node.attrib) <= 8 and len(node.text or '') <= 32768 and len(node.tail or '') <= 1024, 'XML_LIMIT')
        require(all(len(v) <= 1024 for v in node.attrib.values()), 'XML_LIMIT')
        require(not (node.tail or '').strip())
        if len(node):
            require(not (node.text or '').strip())
        require(not any(k in ('Id', 'ID', 'id', '{http://www.w3.org/XML/1998/namespace}id', '{' + SOAP + '}encodingStyle') for k in node.attrib))
    require(root.tag == '{' + SOAP + '}Envelope' and not root.attrib)
    children = list(root)
    if children and children[0].tag == '{' + SOAP + '}Header':
        require(not children[0].attrib and len(children[0]) == 0 and not (children[0].text or '').strip())
        children = children[1:]
    require(len(children) == 1 and children[0].tag == '{' + SOAP + '}Body' and not children[0].attrib)
    require(len(children[0]) == 1)
    payload = children[0][0]
    if payload.tag == '{' + SOAP + '}Fault' and args['mode'] == 'response':
        names = [n.tag for n in payload]
        require(not payload.attrib and len(names) == len(set(names)) and names[:2] == ['faultcode', 'faultstring'])
        require(names in (['faultcode', 'faultstring'], ['faultcode', 'faultstring', 'faultactor'],
                         ['faultcode', 'faultstring', 'detail'], ['faultcode', 'faultstring', 'faultactor', 'detail']))
        value = text(payload, 'faultcode').strip().split(':')
        require(len(value) == 2 and payload.nsmap.get(value[0]) == SOAP and value[1] in ('VersionMismatch', 'MustUnderstand', 'Client', 'Server'))
        text(payload, 'faultstring')
        if 'faultactor' in names:
            text(payload, 'faultactor')
        detail = payload.find('detail')
        if detail is not None:
            require(not detail.attrib and len(detail) == 1 and detail[0].tag == '{' + ERROR + '}Error')
            require(schema.validate(detail[0]), 'XML_SCHEMA')
        return {'kind': 'fault', 'fault': value[1], 'remoteCodes': remote_errors(payload)}
    name = args['operation'] + ('' if args['mode'] == 'request' else 'Response')
    require(payload.tag == '{' + CERT + '}' + name and not payload.attrib)
    require(schema.validate(payload), 'XML_SCHEMA')
    if args['mode'] == 'request':
        return {'kind': 'request', 'operation': args['operation']}
    execution = text(payload, 'n:Status/n:Result').strip()
    errors = remote_errors(payload)
    if args['operation'] == 'VerifyCertificate':
        result = text(payload, 'c:VerificationStatus/c:VerificationResult').strip()
        roles = [n.text or '' for n in one(payload, 'c:RoleList')]
        require(len(roles) <= 32, 'XML_LIMIT')
        roles = [r for r in roles if r]
        require(len(roles) == len(set(roles)) and all(re.fullmatch(r'[012](?:\.(?:0|[1-9][0-9]*)){1,31}', r) for r in roles))
        require(all(len(r) <= 100 and (r.startswith('2.') or int(r.split('.')[1]) <= 39) for r in roles))
        require(result != 'VALID' or (execution == 'OK' and not errors), 'RESULT')
        require(result == 'VALID' or len(errors) > 0, 'RESULT')
        return {'kind': 'verification', 'execution': execution, 'verificationResult': result, 'roles': roles, 'remoteCodes': errors}
    require(execution == 'OK' and not errors, 'RESULT')
    items = list(one(payload, 'cc:X509DataInfoList'))
    require(0 < len(items) <= 4, 'XML_LIMIT')
    certificates = []
    for item in items:
        ref = text(item, 'cc:CertRef').strip()
        data = item.find('cc:X509Data', NS)
        certificates.append({'certRef': ref, 'certificate': None if data is None else base64.b64encode(binary(text(data, 'cc:X509Certificate'), 12000)).decode()})
    require(len({c['certRef'] for c in certificates}) == len(certificates), 'RESULT')
    return {'kind': 'certificates', 'execution': execution, 'certificates': certificates, 'remoteCodes': []}


if __name__ == '__main__':
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        from lxml import etree
        result = run(etree)
    except Rejected as exc:
        result = {'error': str(exc)}
    except Exception:
        result = {'error': 'KIM_CONNECTOR_XML_REJECTED'}
    print(json.dumps(result, separators=(',', ':')))
