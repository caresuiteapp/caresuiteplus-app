"""Strict binary CMS subset on top of pinned gematik XSD validation."""
import base64

SIG = 'http://ws.gematik.de/conn/SignatureService/v7.5'
CRYPT = 'http://ws.gematik.de/conn/EncryptionService/v6.1'
DSS = 'urn:oasis:names:tc:dss:1.0:core:schema'
CONN = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0'
CMS = 'urn:ietf:rfc:5652'


def inspect(payload, operation, mode, require, binary):
    def children(node, tags):
        require(not node.attrib and [n.tag for n in node] == tags, 'CMS_PROFILE')

    def data(node, maximum=22020096, mime='application/octet-stream'):
        require(len(node) == 0 and (dict(node.attrib) == {'MimeType': mime} or (mode == 'response' and dict(node.attrib) in ({}, {'MimeType': 'application/octet-stream'}, {'MimeType': 'application/pkcs7-mime'}))), 'CMS_PROFILE')
        return base64.b64encode(binary(node.text, maximum)).decode()

    def value(node, expected=None):
        require(not node.attrib and len(node) == 0, 'CMS_PROFILE')
        require(expected is None or node.text == expected, 'CMS_PROFILE')
        return node.text

    def prop(node):
        children(node, ['{' + DSS + '}Property'])
        children(node[0], ['{' + DSS + '}Identifier', '{' + DSS + '}Value'])
        value(node[0][0], 'urn:oid:1.2.276.0.76.4.173')
        children(node[0][1], ['CMSAttribute'])
        binary(value(node[0][1][0]), 262144)

    if operation == 'VerifyDocument':
        import importlib.util
        from pathlib import Path
        spec = importlib.util.spec_from_file_location('verify_xml', Path(__file__).with_name('connector-verify-xml.py'))
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        return module.inspect(payload, mode, require, binary)
    if operation == 'GetJobNumber':
        if mode == 'response':
            children(payload, ['{' + SIG + '}JobNumber'])
            return {'kind': 'job-number', 'jobNumber': value(payload[0])}
        return {'kind': 'request', 'operation': operation}
    if mode == 'request':
        if operation == 'SignDocument':
            value(payload[1], 'ECC'); value(payload[3], 'NONE')
            require(len(payload) == 6, 'CMS_PROFILE')
            req = payload[5]
            require(set(req.attrib) == {'RequestID'} and len(req) == 3, 'CMS_PROFILE')
            component = len(req[0]) == 2
            children(req[0], ['{' + DSS + '}SignatureType'] + ([] if component else ['{' + DSS + '}Properties']) + ['{' + SIG + '}IncludeEContent'])
            value(req[0][0], CMS); value(req[0][-1], 'true')
            if not component:
                children(req[0][1], ['{' + DSS + '}SignedProperties']); prop(req[0][1][0])
            children(req[1], ['{' + DSS + '}Base64Data']); data(req[1][0], 15000000)
            value(req[2], 'false')
        elif operation == 'EncryptDocument':
            require(len(payload) == 4 and not payload[1].attrib and 1 <= len(payload[1]) <= 1000, 'CMS_PROFILE')
            for cert in payload[1]:
                require(cert.tag == '{' + CRYPT + '}Certificate', 'CMS_PROFILE'); binary(value(cert), 12000)
            children(payload[2], ['{' + DSS + '}Base64Data']); data(payload[2][0])
            children(payload[3], ['{' + CRYPT + '}EncryptionType', '{' + CRYPT + '}UnprotectedProperties'])
            value(payload[3][0], CMS); prop(payload[3][1])
        else:
            require(len(payload) == 3, 'CMS_PROFILE')
            children(payload[1], ['{' + CONN + '}CardHandle', '{' + CRYPT + '}KeyReference'])
            value(payload[1][1], 'C.ENC')
            children(payload[2], ['{' + DSS + '}Base64Data']); data(payload[2][0])
        return {'kind': 'request', 'operation': operation}
    if operation == 'SignDocument':
        children(payload, ['{' + SIG + '}SignResponse'])
        response = payload[0]
        require(set(response.attrib) == {'RequestID'} and [n.tag for n in response] == ['{' + CONN + '}Status', '{' + DSS + '}SignatureObject'], 'CMS_PROFILE')
        children(response[1], ['{' + DSS + '}Base64Signature'])
        signature = response[1][0]
        require(not len(signature) and dict(signature.attrib) == {'Type': CMS}, 'CMS_PROFILE')
        result = {'kind': 'cms-signature', 'requestId': response.get('RequestID'), 'data': base64.b64encode(binary(signature.text, 22020096)).decode()}
    else:
        response = payload
        children(response, ['{' + CONN + '}Status', '{' + CONN + '}Document'])
        children(response[1], ['{' + DSS + '}Base64Data'])
        result = {'kind': 'cms-document', 'data': data(response[1][0], mime='application/pkcs7-mime' if operation == 'EncryptDocument' else 'application/octet-stream')}
    children(response[0], ['{' + CONN + '}Result'])
    value(response[0][0], 'OK')
    return result
