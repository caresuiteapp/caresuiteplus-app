"""Bounded, single-signer nonQES report. Negative reports are attachment data only.
The enclosing worker validates the pinned SignatureService/VerificationReport XSDs.
"""
import base64
import hashlib
import re
from datetime import datetime

SIG = 'http://ws.gematik.de/conn/SignatureService/v7.5'
DSS = 'urn:oasis:names:tc:dss:1.0:core:schema'
VR = 'urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:schema#'
DS = 'http://www.w3.org/2000/09/xmldsig#'
XADES = 'http://uri.etsi.org/01903/v1.3.2#'
CONN = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0'
CTX = 'http://ws.gematik.de/conn/ConnectorContext/v2.0'
SUCCESS = 'urn:oasis:names:tc:dss:1.0:resultmajor:Success'
VALID = 'urn:oasis:names:tc:dss:1.0:detail:valid'
MINOR = 'urn:oasis:names:tc:dss:1.0:resultminor:valid:signature:OnAllDocuments'
NS = {'c': SIG, 'dss': DSS, 'vr': VR, 'ds': DS}


def inspect(payload, mode, require, binary):
    from lxml import etree

    def children(node, tags):
        require(not node.attrib and [n.tag for n in node] == tags, 'CMS_VERIFY_PROFILE')

    def one(node, path):
        nodes = node.findall(path, NS)
        require(len(nodes) == 1, 'CMS_VERIFY_PROFILE')
        return nodes[0]

    def value(node, expected=None):
        require(not node.attrib and len(node) == 0, 'CMS_VERIFY_PROFILE')
        text = node.text or ''
        require(expected is None or text == expected, 'CMS_VERIFY_PROFILE')
        return text

    def instant(node):
        text = value(node)
        require(re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})', text), 'CMS_VERIFY_TIME')
        return int(datetime.fromisoformat(text.replace('Z', '+00:00')).timestamp() * 1000)

    if mode == 'request':
        children(payload, ['{' + CTX + '}Context', '{' + SIG + '}OptionalInputs', '{' + DSS + '}SignatureObject', '{' + SIG + '}IncludeRevocationInfo'])
        children(payload[1], ['{' + SIG + '}UseVerificationTime', '{' + VR + '}ReturnVerificationReport'])
        children(payload[1][0], ['{' + DSS + '}CurrentTime']); value(payload[1][0][0], '')
        flags = ['IncludeVerifier', 'IncludeCertificateValues', 'IncludeRevocationValues', 'ExpandBinaryValues', 'ReportDetailLevel']
        children(payload[1][1], ['{' + VR + '}' + n for n in flags])
        for n, text in zip(payload[1][1], ['false', 'true', 'true', 'false', 'urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:reportdetail:allDetails']):
            value(n, text)
        children(payload[2], ['{' + DSS + '}Base64Signature'])
        signature = payload[2][0]
        require(not len(signature) and dict(signature.attrib) == {'Type': 'urn:ietf:rfc:5652'}, 'CMS_VERIFY_PROFILE')
        binary(signature.text, 22020096); value(payload[3], 'false')
        return {'kind': 'request', 'operation': 'VerifyDocument'}

    require(len(etree.tostring(payload)) <= 262144, 'CMS_VERIFY_LIMIT')
    children(payload, ['{' + CONN + '}Status', '{' + SIG + '}VerificationResult', '{' + SIG + '}OptionalOutputs'])
    children(payload[0], ['{' + CONN + '}Result']); value(payload[0][0], 'OK')
    children(payload[1], ['{' + SIG + '}' + n for n in ['HighLevelResult', 'TimestampType', 'Timestamp']])
    high = value(payload[1][0]); timestamp_type = value(payload[1][1]); timestamp = instant(payload[1][2])
    children(payload[2], ['{' + VR + '}VerificationReport'])
    report = payload[2][0]
    children(report, ['{' + DSS + '}VerificationTimeInfo', '{' + VR + '}IndividualReport'])
    children(report[0], ['{' + DSS + '}VerificationTime'])
    checked_at = instant(report[0][0])
    individual = report[1]
    children(individual, ['{' + VR + '}SignedObjectIdentifier', '{' + DSS + '}Result', '{' + VR + '}Details'])
    identifier, result, details = individual
    # Single enveloping signature: no reference resolution, manifests, XPath,
    # countersignatures or arbitrary extension namespaces.
    for node in report.iter():
        name = etree.QName(node)
        require(name.namespace in (DSS, VR, DS, SIG, XADES), 'CMS_VERIFY_PROFILE')
        require(not set(node.attrib).intersection({'URI', 'XPath', 'WhichDocument', 'Target', 'IdRef'}), 'CMS_VERIFY_PROFILE')
        require(name.localname not in ('CounterSignatureMarker', 'Manifest', 'Transforms', 'Reference', 'RevocationInfo'), 'CMS_VERIFY_PROFILE')
        if name.localname == 'Other':
            require(len(node) > 0 and all(n.tag in ['{' + SIG + '}' + t for t in ['ShortText', 'ReferenceToSignerCertificate', 'DisplayableAttributes']] for n in node), 'CMS_VERIFY_PROFILE')
    signature = binary(value(one(identifier, 'ds:SignatureValue')), 72)
    require(len(signature) >= 8, 'CMS_VERIFY_PROFILE')
    # ResultMessage may contain subjects or diagnostics; retain no prose.
    require(not result.attrib and [n.tag for n in result][:2] == ['{' + DSS + '}ResultMajor', '{' + DSS + '}ResultMinor']
            and len(result) in (2, 3) and (len(result) == 2 or result[2].tag == '{' + DSS + '}ResultMessage'), 'CMS_VERIFY_PROFILE')
    major, minor = value(result[0]), value(result[1])
    require(not details.attrib and len(details) == 2 and set(n.tag for n in details) == {'{' + DSS + '}VerificationTimeInfo', '{' + VR + '}DetailedSignatureReport'}, 'CMS_VERIFY_PROFILE')
    time_info = one(details, 'dss:VerificationTimeInfo'); children(time_info, ['{' + DSS + '}VerificationTime'])
    require(instant(time_info[0]) == timestamp, 'CMS_VERIFY_TIME')
    detailed = one(details, 'vr:DetailedSignatureReport')
    for path in ['vr:FormatOK', 'vr:SignatureOK/vr:SigMathOK', 'vr:CertificatePathValidity/vr:PathValiditySummary']:
        one(one(detailed, path), 'vr:ResultMajor')
    path = one(detailed, 'vr:CertificatePathValidity/vr:PathValidityDetail')
    certs = path.findall('vr:CertificateValidity/vr:CertificateValue', NS)
    require(1 <= len(certs) <= 8, 'CMS_VERIFY_PROFILE')
    fingerprints = [hashlib.sha256(binary(value(c), 12000)).hexdigest() for c in certs]
    require(len(fingerprints) == len(set(fingerprints)), 'CMS_VERIFY_PROFILE')
    # No successful aggregate may hide a failed or unknown subordinate check.
    checks = report.findall('.//vr:ResultMajor', NS)
    require(3 <= len(checks) <= 128, 'CMS_VERIFY_PROFILE')
    # TrustAnchor is an identifier, not a validity result (gemSpec_Kon B3).
    all_valid = all(value(n) == 'urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:trustanchor:certDataBase'
                    if n.getparent().tag == '{' + VR + '}TrustAnchor' else value(n) in (SUCCESS, VALID) for n in checks)
    canonical = etree.tostring(report, method='c14n', exclusive=True, with_comments=False)
    require(len(canonical) <= 262144, 'CMS_VERIFY_LIMIT')
    consistent = high == 'VALID' and major == SUCCESS and minor == MINOR and all_valid
    return {'kind': 'cms-verification', 'verificationResult': high, 'timestampType': timestamp_type,
            'timestamp': timestamp, 'verificationTime': checked_at,
            'resultConsistent': consistent,
            'signatureSha256': hashlib.sha256(signature).hexdigest(), 'certificateSha256': fingerprints,
            'reportSha256': hashlib.sha256(canonical).hexdigest(),
            **({} if consistent else {'reportBase64': base64.b64encode(canonical).decode('ascii')})}
