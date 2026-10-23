"""Bounded TSL XML/XSD/C14N worker. Never a trust-anchor or signature verifier.

Requires an existing Python 3 + lxml installation on the service host. All XSD
imports resolve from the pinned local bundle; document URLs are never fetched.
Only fixed error codes leave this process, never XML or parser diagnostics.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
from datetime import datetime, timezone

TSL = "http://uri.etsi.org/02231/v2#"
DS = "http://www.w3.org/2000/09/xmldsig#"
C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
EXC = "http://www.w3.org/2001/10/xml-exc-c14n#"
NS = {"t": TSL, "ds": DS}
MANIFEST = "ffd4e6ae233c8e648ec009a55a9809fad9fcc4197f7928a48e15b5dbdde7137b"


class Rejected(Exception):
    pass


def require(ok, code="KIM_TSL_XML_PROFILE"):
    if not ok:
        raise Rejected(code)


def one(node, path):
    values = node.findall(path, NS)
    require(len(values) == 1)
    return values[0]


def text(node, path):
    element = one(node, path)
    require(len(element) == 0 and element.text is not None)
    return element.text.strip()


def binary(value, limit=12000):
    value = re.sub(r"[\t\r\n ]", "", value)
    require(len(value) <= (limit + 2) // 3 * 4, "KIM_TSL_XML_LIMIT")
    data = base64.b64decode(value, validate=True)
    require(data and len(data) <= limit and base64.b64encode(data).decode() == value)
    return data


def date(value):
    require(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})", value) is not None)
    instant = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    delta = instant - datetime(1970, 1, 1, tzinfo=timezone.utc)
    milliseconds = delta.days * 86400000 + delta.seconds * 1000 + delta.microseconds // 1000
    require(0 <= milliseconds <= 253402300799999)
    return milliseconds


def service_extension_oids(info):
    result = []
    extensions = info.findall("t:ServiceInformationExtensions/t:Extension", NS)
    require(len(extensions) <= 128, "KIM_TSL_XML_LIMIT")
    for extension in extensions:
        children = [n for n in extension if isinstance(n.tag, str)]
        names = [n.tag for n in children]
        oid_tag, value_tag, values_tag = ["{" + TSL + "}" + n for n in ("ExtensionOID", "ExtensionValue", "ExtensionValues")]
        if not any(n in (oid_tag, value_tag, values_tag) for n in names):
            continue  # Unknown noncritical extensions cannot authorize types.
        require(len(children) == 2 and names[0] == oid_tag and names[1] in (value_tag, values_tag), "KIM_TSL_SERVICE_EXTENSION")
        oid_node = children[0]
        value = oid_node.text or ""
        require(not oid_node.attrib and len(oid_node) == 0 and len(value) <= 256
                and re.fullmatch(r"(?:0|1|2)(?:\.(?:0|[1-9][0-9]*)){1,31}", value) is not None,
                "KIM_TSL_SERVICE_EXTENSION")
        arcs = [int(a) for a in value.split(".")]
        require(all(a <= 2**63-1 for a in arcs) and (arcs[0] == 2 or arcs[1] <= 39)
                and value not in result, "KIM_TSL_SERVICE_EXTENSION")
        if names[1] == value_tag:
            require(len(children[1]) == 0 and len(children[1].text or "") <= 2048, "KIM_TSL_SERVICE_EXTENSION")
        else:
            # ExtensionValues is an opaque complexType. Its nested identifiers
            # never grant additional certificate types (Tab_PKI_716).
            require(sum(1 for _ in children[1].iter()) <= 256, "KIM_TSL_XML_LIMIT")
        result.append(value)
    return result


def run(etree):
    directory = Path(__file__).resolve().parent / "tsl-schema"
    manifest = (directory / "manifest.json").read_bytes()
    require(hashlib.sha256(manifest).hexdigest() == MANIFEST, "KIM_TSL_SCHEMA_INTEGRITY")
    schemas = {}
    for name, fingerprint in json.loads(manifest)["files"].items():
        require(name in ("tsl.xsd", "xml.xsd", "xmldsig-core-schema.xsd"), "KIM_TSL_SCHEMA_INTEGRITY")
        schemas[name] = (directory / name).read_bytes()
        require(hashlib.sha256(schemas[name]).hexdigest() == fingerprint, "KIM_TSL_SCHEMA_INTEGRITY")
    require(len(schemas) == 3, "KIM_TSL_SCHEMA_INTEGRITY")

    class Resolver(etree.Resolver):
        def resolve(self, url, public_id, context):
            name = url.removeprefix("https://schemas.invalid/")
            require(name in schemas, "KIM_TSL_SCHEMA_IMPORT")
            return self.resolve_string(schemas[name], context, base_url="https://schemas.invalid/" + name)

    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             recover=False, huge_tree=False, remove_blank_text=False)
    parser.resolvers.add(Resolver())
    schema = etree.XMLSchema(etree.fromstring(schemas["tsl.xsd"], parser, base_url="https://schemas.invalid/tsl.xsd"))
    raw = sys.stdin.buffer.read(8 * 1024 * 1024 + 1)
    require(0 < len(raw) <= 8 * 1024 * 1024, "KIM_TSL_XML_LIMIT")
    decoded = raw.decode("utf-8-sig", errors="strict")
    require("<!DOCTYPE" not in decoded and "<!ENTITY" not in decoded, "KIM_TSL_XML_DTD")
    declaration = re.match(r"<\?xml\s.*?\?>", decoded, re.DOTALL)
    if declaration:
        encoding = re.search(r"encoding\s*=\s*['\"]([^'\"]+)['\"]", declaration[0])
        require(encoding is None or encoding[1].upper() == "UTF-8")
    root = etree.fromstring(raw, parser)
    tree = root.getroottree()
    require(not tree.docinfo.doctype and not tree.xpath("//processing-instruction()"))
    require(root.tag == "{" + TSL + "}TrustServiceStatusList")
    count, ids = 0, set()
    for event, node in etree.iterwalk(root, events=("start",)):
        count += 1
        require(count <= 100000 and len(list(node.iterancestors())) <= 64 and len(node.attrib) <= 32, "KIM_TSL_XML_LIMIT")
        require(len(node.text or "") <= 131072 and len(node.tail or "") <= 131072, "KIM_TSL_XML_LIMIT")
        for key, value in node.attrib.items():
            require(len(value) <= 2048, "KIM_TSL_XML_LIMIT")
            if key in ("Id", "ID", "id", "{http://www.w3.org/XML/1998/namespace}id"):
                require(value not in ids, "KIM_TSL_XML_ID")
                ids.add(value)
        if node.tag == "{" + TSL + "}Extension":
            require(node.get("Critical", "").strip() not in ("true", "1"), "KIM_TSL_CRITICAL_EXTENSION")
    require(schema.validate(root), "KIM_TSL_XSD")
    root_id = root.get("Id", "")
    require(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,127}", root_id) is not None, "KIM_TSL_XML_ID")
    scheme = one(root, "t:SchemeInformation")
    require(text(scheme, "t:TSLVersionIdentifier") == "3")
    require(text(scheme, "t:TSLType") == "http://uri.etsi.org/TrstSvc/TSLtype/generic")
    require(text(scheme, "t:StatusDeterminationApproach") == "http://uri.etsi.org/TrstSvc/TSLType/StatusDetn/passive")
    territory = scheme.find("t:SchemeTerritory", NS)
    require(territory is None or territory.text == "DE")
    sequence = int(text(scheme, "t:TSLSequenceNumber"))
    require(0 < sequence <= 9007199254740991)
    issued = date(text(scheme, "t:ListIssueDateTime"))
    next_update = date(text(scheme, "t:NextUpdate/t:dateTime"))

    # Only one enveloped signature over the entire root. No XPath, XSLT,
    # external references, alternate KeyInfo lookup or nested signatures.
    signature = one(root, "ds:Signature")
    require(len(root.findall(".//ds:Signature", NS)) == 1, "KIM_TSL_XML_SIGNATURE")
    require([n.tag for n in signature] == ["{" + DS + "}" + n for n in ("SignedInfo", "SignatureValue", "KeyInfo")])
    info = one(signature, "ds:SignedInfo")
    require([n.tag for n in info] == ["{" + DS + "}" + n for n in ("CanonicalizationMethod", "SignatureMethod", "Reference")])

    def canonical(node, algorithm):
        require(algorithm in (C14N, C14N + "#WithComments", EXC, EXC + "WithComments"), "KIM_TSL_XML_ALGORITHM")
        return etree.tostring(node, method="c14n", exclusive=algorithm.startswith(EXC), with_comments=algorithm.endswith("WithComments"))

    method = one(info, "ds:CanonicalizationMethod")
    require(len(method) == 0, "KIM_TSL_XML_ALGORITHM")
    signed_info = canonical(info, method.get("Algorithm"))
    require(len(signed_info) <= 32768, "KIM_TSL_XML_LIMIT")
    signature_method = one(info, "ds:SignatureMethod")
    require(len(signature_method) == 0, "KIM_TSL_XML_ALGORITHM")
    reference = one(info, "ds:Reference")
    require(reference.get("URI") == "#" + root_id and reference.get("Type") is None, "KIM_TSL_XML_REFERENCE")
    transforms = list(one(reference, "ds:Transforms"))
    require(1 <= len(transforms) <= 2 and all(n.tag == "{" + DS + "}Transform" and len(n) == 0 for n in transforms), "KIM_TSL_XML_ALGORITHM")
    require(transforms[0].get("Algorithm") == DS + "enveloped-signature", "KIM_TSL_XML_ALGORITHM")
    digest_method = one(reference, "ds:DigestMethod")
    require(len(digest_method) == 0 and digest_method.get("Algorithm") == "http://www.w3.org/2001/04/xmlenc#sha256", "KIM_TSL_XML_ALGORITHM")
    expected_digest = binary(text(reference, "ds:DigestValue"), 32)
    key_info = one(signature, "ds:KeyInfo")
    x509 = one(key_info, "ds:X509Data")
    require(len(key_info) == 1 and len(x509) == 1)
    signer = binary(text(x509, "ds:X509Certificate"))
    signature_value = binary(text(signature, "ds:SignatureValue"), 1024)

    providers = one(root, "t:TrustServiceProviderList")
    services = []
    for service in providers.findall("t:TrustServiceProvider/t:TSPServices/t:TSPService", NS):
        history = service.find("t:ServiceHistory", NS)
        require(history is None or len(history) == 0, "KIM_TSL_SERVICE_HISTORY")
        info_node = one(service, "t:ServiceInformation")
        kind = text(info_node, "t:ServiceTypeIdentifier")
        status = text(info_node, "t:ServiceStatus")
        started = date(text(info_node, "t:StatusStartingTime"))
        identity = one(info_node, "t:ServiceDigitalIdentity")
        certificates = [base64.b64encode(binary(n.text or "")).decode() for n in identity.findall("t:DigitalId/t:X509Certificate", NS)]
        # Other service types (QES, CVC, DNS, rollover) remain metadata only.
        if kind in ("http://uri.etsi.org/TrstSvc/Svctype/CA/PKC", "http://uri.etsi.org/TrstSvc/Svctype/Certstatus/OCSP"):
            require(len(certificates) == 1, "KIM_TSL_SERVICE_IDENTITY")
            require(status in ("http://uri.etsi.org/TrstSvc/Svcstatus/inaccord", "http://uri.etsi.org/TrstSvc/Svcstatus/revoked"), "KIM_TSL_SERVICE_STATUS")
            if kind.endswith("/OCSP"):
                require(status.endswith("/inaccord"), "KIM_TSL_SERVICE_STATUS")
        endpoints = [n.text.strip() for n in info_node.findall("t:ServiceSupplyPoints/t:ServiceSupplyPoint", NS)]
        require(len(endpoints) <= 16 and all(len(u) <= 2048 for u in endpoints), "KIM_TSL_XML_LIMIT")
        services.append({"type": kind, "status": status, "statusStartingTime": started,
                         "certificates": certificates, "supplyPoints": endpoints,
                         "extensionOids": service_extension_oids(info_node)})
        require(len(services) <= 2048, "KIM_TSL_XML_LIMIT")

    # Removing an enveloped Signature must retain following character data.
    tail, previous = signature.tail, signature.getprevious()
    if tail:
        if previous is None:
            root.text = (root.text or "") + tail
        else:
            previous.tail = (previous.tail or "") + tail
    signature.tail = None
    root.remove(signature)
    digest_input = canonical(root, transforms[1].get("Algorithm") if len(transforms) == 2 else C14N)
    require(hashlib.sha256(digest_input).digest() == expected_digest, "KIM_TSL_XML_DIGEST")
    return {"id": root_id, "sequence": sequence, "issuedAt": issued, "nextUpdate": next_update,
            "services": services, "signedInfo": base64.b64encode(signed_info).decode(),
            "signatureMethod": signature_method.get("Algorithm"), "signature": base64.b64encode(signature_value).decode(),
            "signer": base64.b64encode(signer).decode(), "schemaSha256": MANIFEST}


if __name__ == "__main__":
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
        from lxml import etree
        result = run(etree)
        sys.stdout.write(json.dumps(result, separators=(",", ":")))
    except Rejected as error:
        sys.stdout.write(json.dumps({"error": str(error)}))
    except ImportError:
        sys.stdout.write('{"error":"KIM_TSL_XML_UNAVAILABLE"}')
    except Exception:
        sys.stdout.write('{"error":"KIM_TSL_XML_REJECTED"}')
