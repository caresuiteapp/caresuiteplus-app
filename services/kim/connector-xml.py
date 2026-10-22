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
EVENT = 'http://ws.gematik.de/conn/EventService/v7.2'
CARD = 'http://ws.gematik.de/conn/CardService/v8.1'
CARDCMN = 'http://ws.gematik.de/conn/CardServiceCommon/v2.0'
AUTH = 'http://ws.gematik.de/conn/SignatureService/v7.4'
DSS = 'urn:oasis:names:tc:dss:1.0:core:schema'
SIG = 'http://ws.gematik.de/conn/SignatureService/v7.5'
CRYPT = 'http://ws.gematik.de/conn/EncryptionService/v6.1'
CMS_PROCESS = sys.argv[1:] == ['--cms']
CMS_OPS = ('GetJobNumber', 'SignDocument', 'EncryptDocument', 'DecryptDocument')
ECDSA = 'urn:bsi:tr:03111:ecdsa'
COMMON = 'http://ws.gematik.de/conn/CertificateServiceCommon/v2.0'
CONN = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0'
ERROR = 'http://ws.gematik.de/tel/error/v2.0'
MANIFEST = '248a189e5c7436fc465ffe1fc58df928271f0e6f24b4b211d034c7c3ef217d8a'
NS = {'s': SOAP, 'c': CERT, 'cc': COMMON, 'n': CONN, 'e': ERROR, 'event': EVENT, 'card': CARD, 'cm': CARDCMN, 'auth': AUTH, 'dss': DSS}


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
        require(re.fullmatch(r'(?:conn|ext|tel/error|tel/version)/[A-Za-z0-9_.-]+\.(?:xsd|wsdl)|LICENSE-gematik\.txt', name) is not None, 'SCHEMA_INTEGRITY')
        data = (folder / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == fingerprint, 'SCHEMA_INTEGRITY')
        schemas['https://schemas.invalid/' + name] = data

    class Resolver(etree.Resolver):
        def resolve(self, url, public_id, context):
            require(url in schemas, 'SCHEMA_IMPORT')
            return self.resolve_string(schemas[url], context, base_url=url)

    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             recover=False, huge_tree=CMS_PROCESS, remove_blank_text=False)
    parser.resolvers.add(Resolver())
    input_limit = 46 * 1024 * 1024 if CMS_PROCESS else 600000
    raw_input = sys.stdin.buffer.read(input_limit + 1)
    require(0 < len(raw_input) <= input_limit, 'XML_LIMIT')
    args = json.loads(raw_input)
    require(args.get('operation') in ('ReadCardCertificate', 'VerifyCertificate', 'GetCards', 'GetPinStatus', 'VerifyPin', 'ChangePin', 'UnblockPin', 'ExternalAuthenticate') + CMS_OPS)
    require(args.get('mode') in ('request', 'response'))
    is_cms = args['operation'] in CMS_OPS
    require(is_cms == CMS_PROCESS, 'XML_PROFILE')
    is_sig = args['operation'] in ('SignDocument', 'GetJobNumber')
    is_cards = args['operation'] == 'GetCards'
    is_pin = args['operation'] in ('GetPinStatus', 'VerifyPin', 'ChangePin', 'UnblockPin')
    is_auth = args['operation'] == 'ExternalAuthenticate'
    url = 'https://schemas.invalid/conn/' + ('SignatureService_V7_5_7.xsd' if is_sig else 'EncryptionService_v6_1_2.xsd' if is_cms else 'EventService.xsd' if is_cards else 'CardService.xsd' if is_pin else 'SignatureService.xsd' if is_auth else 'CertificateService_v6_0_2.xsd')
    schema = etree.XMLSchema(etree.fromstring(schemas[url], parser, base_url=url))
    raw = binary(args['xml'], 32 * 1024 * 1024 if is_cms else 262144)
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
        require(len(node.attrib) <= 8 and len(node.text or '') <= (30000000 if is_cms and node.tag in ('{' + DSS + '}Base64Data', '{' + DSS + '}Base64Signature') else 524288 if is_cms and node.tag == 'CMSAttribute' else 32768) and len(node.tail or '') <= 1024, 'XML_LIMIT')
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
    require(payload.tag == '{' + (SIG if is_sig else CRYPT if is_cms else EVENT if is_cards else CARD if is_pin else AUTH if is_auth else CERT) + '}' + name)
    require(not payload.attrib or (is_cards and args['mode'] == 'request' and set(payload.attrib) == {'mandant-wide'}))
    require(schema.validate(payload), 'XML_SCHEMA')
    if is_cms:
        import importlib.util
        spec = importlib.util.spec_from_file_location('cms_xml', Path(__file__).with_name('connector-document-xml.py'))
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        return module.inspect(payload, args['operation'], args['mode'], require, binary)
    if args['mode'] == 'request':
        if is_auth:
            options = one(payload, 'auth:OptionalInputs')
            require(not options.attrib and len(options) == 1 and text(options, 'dss:SignatureType') == ECDSA, 'AUTH_PROFILE')
            content = one(payload, 'auth:BinaryString')
            require(not content.attrib and len(content) == 1, 'AUTH_PROFILE')
            data = one(content, 'dss:Base64Data')
            require(not len(data) and dict(data.attrib) == {'MimeType': 'application/octet-stream'}, 'AUTH_PROFILE')
            require(len(binary(data.text, 32)) == 32, 'AUTH_PROFILE')
        if is_pin:
            require(text(payload, 'cm:PinTyp') == 'PIN.SMC', 'PIN_PROFILE')
        if args['operation'] == 'UnblockPin':
            require(text(payload, 'card:SetNewPin') in ('true', 'false'), 'PIN_PROFILE')
        return {'kind': 'request', 'operation': args['operation']}
    execution = text(payload, 'n:Status/n:Result').strip()
    errors = remote_errors(payload)
    if is_auth:
        require(execution == 'OK' and not errors, 'AUTH_RESULT')
        signature = one(payload, 'dss:SignatureObject')
        require(not signature.attrib and len(signature) == 1, 'AUTH_PROFILE')
        data = one(signature, 'dss:Base64Signature')
        require(not len(data) and dict(data.attrib) == {'Type': ECDSA}, 'AUTH_PROFILE')
        return {'kind': 'authentication', 'execution': execution, 'signatureType': ECDSA,
                'signature': base64.b64encode(binary(data.text, 72)).decode(), 'remoteCodes': []}
    if is_pin:
        status = args['operation'] == 'GetPinStatus'
        prefix = 'card:' if status else 'cm:'
        result = text(payload, prefix + ('PinStatus' if status else 'PinResult'))
        tries = payload.find(prefix + 'LeftTries', NS)
        left = None if tries is None else int(text(payload, prefix + 'LeftTries'))
        maximum = 10 if args['operation'] == 'UnblockPin' else 3
        require(left is None or 0 <= left <= maximum, 'PIN_RESULT')
        if args['operation'] in ('ChangePin', 'UnblockPin'):
            require(result != 'TRANSPORT_PIN', 'PIN_RESULT')
        if not status and result == 'ERROR':
            require(len(errors) > 0, 'PIN_RESULT')
        else:
            require(execution == 'OK' and not errors, 'PIN_RESULT')
        if result in ('VERIFIABLE', 'REJECTED'):
            require(left is not None and 1 <= left <= maximum, 'PIN_RESULT')
        elif result == 'BLOCKED':
            require(left == 0, 'PIN_RESULT')
        elif result in ('WASBLOCKED', 'NOWBLOCKED'):
            require(left is None or left == 0, 'PIN_RESULT')
        elif result in ('VERIFIED', 'OK'):
            require(left is None, 'PIN_RESULT')
        elif status and result in ('TRANSPORT_PIN', 'EMPTY_PIN'):
            require(left is None or left > 0, 'PIN_RESULT')
        return {'kind': 'pin-status' if status else 'pin-result', 'execution': execution,
                'pinStatus' if status else 'pinResult': result, 'leftTries': left, 'remoteCodes': errors}
    if is_cards:
        require(execution == 'OK' and not errors, 'RESULT')
        entries = list(one(payload, 'card:Cards'))
        require(len(entries) <= 64, 'XML_LIMIT')
        cards = []
        for entry in entries:
            inserted = text(entry, 'card:InsertTime')
            require(len(inserted) <= 64 and re.search(r'(?:Z|[+-][0-9]{2}:[0-9]{2})$', inserted), 'CARD_FORMAT')
            card = {'cardHandle': text(entry, 'n:CardHandle'), 'cardType': text(entry, 'cm:CardType'),
                    'ctId': text(entry, 'cm:CtId'), 'slotId': int(text(entry, 'cm:SlotId')), 'insertTime': inserted}
            if entry.find('cm:Iccsn', NS) is not None:
                card['iccsn'] = text(entry, 'cm:Iccsn')
            version = entry.find('card:CardVersion', NS)
            card['cardVersion'] = {} if version is None else {
                etree.QName(v).localname: [int(text(v, 'card:' + field)) for field in ('Major', 'Minor', 'Revision')] for v in version}
            cards.append(card)  # No CardHolderName, KVNR or claimed expiration in the result.
        return {'kind': 'cards', 'cards': cards, 'execution': execution, 'remoteCodes': []}
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
        resource.setrlimit(resource.RLIMIT_CPU, (10, 10) if CMS_PROCESS else (3, 3))
        resource.setrlimit(resource.RLIMIT_AS, ((768 if CMS_PROCESS else 256) * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        from lxml import etree
        result = run(etree)
    except Rejected as exc:
        result = {'error': str(exc)}
    except Exception:
        result = {'error': 'KIM_CONNECTOR_XML_REJECTED'}
    print(json.dumps(result, separators=(',', ':')))
