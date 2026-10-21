"""Isolated synthetic list; no gematik identity or production endpoints."""
import base64
import copy
import hashlib
import json
import sys
from datetime import datetime, timezone
from lxml import etree as E

T = "http://uri.etsi.org/02231/v2#"
D = "http://www.w3.org/2000/09/xmldsig#"
C = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
X = "http://www.w3.org/2001/10/xml-exc-c14n#"
o = json.load(sys.stdin)
root = E.Element("{" + T + "}TrustServiceStatusList", nsmap={o.get("prefix", "t"): T, "ds": D, "unused": "urn:caresuite:test"},
                 Id=o["id"], TSLTag="http://uri.etsi.org/02231/TSLTag")


def add(parent, name, value=None, ns=T, **attributes):
    n = E.SubElement(parent, "{" + ns + "}" + name, **attributes)
    if value is not None:
        n.text = str(value)
    return n


def multilingual(parent, name, child, value):
    add(add(parent, name), child, value, **{"{http://www.w3.org/XML/1998/namespace}lang": "de"})


def address(parent, name):
    a = add(parent, name)
    p = add(add(a, "PostalAddresses"), "PostalAddress", **{"{http://www.w3.org/XML/1998/namespace}lang": "de"})
    for k, v in {"StreetAddress": "Teststrasse 1", "Locality": "Teststadt", "CountryName": "DE"}.items():
        add(p, k, v)
    add(add(a, "ElectronicAddress"), "URI", "mailto:nobody@example.invalid")


def date(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


s = add(root, "SchemeInformation")
add(s, "TSLVersionIdentifier", 3)
add(s, "TSLSequenceNumber", o["sequence"])
add(s, "TSLType", "http://uri.etsi.org/TrstSvc/TSLtype/generic")
multilingual(s, "SchemeOperatorName", "Name", "Isolated local fixture")
address(s, "SchemeOperatorAddress")
multilingual(s, "SchemeName", "Name", "Not a trusted TI list")
multilingual(s, "SchemeInformationURI", "URI", "https://example.invalid/test-tsl")
add(s, "StatusDeterminationApproach", "http://uri.etsi.org/TrstSvc/TSLType/StatusDetn/passive")
add(s, "SchemeTerritory", "DE")
add(s, "HistoricalInformationPeriod", 0)
add(s, "ListIssueDateTime", date(o["issuedAt"]))
add(add(s, "NextUpdate"), "dateTime", date(o["nextUpdate"]))
p = add(add(root, "TrustServiceProviderList"), "TrustServiceProvider")
i = add(p, "TSPInformation")
multilingual(i, "TSPName", "Name", "Test provider")
address(i, "TSPAddress")
multilingual(i, "TSPInformationURI", "URI", "https://example.invalid/test-provider")
services = add(p, "TSPServices")
for service in o["services"]:
    t = add(add(services, "TSPService"), "ServiceInformation")
    add(t, "ServiceTypeIdentifier", service["type"])
    multilingual(t, "ServiceName", "Name", "Fictional service")
    add(add(add(t, "ServiceDigitalIdentity"), "DigitalId"), "X509Certificate", service["certificate"])
    add(t, "ServiceStatus", service["status"])
    add(t, "StatusStartingTime", date(service["started"]))
    endpoints = service.get("supplyPoints", ["https://example.invalid/ocsp"])
    if endpoints:
        points = add(t, "ServiceSupplyPoints")
        for endpoint in endpoints:
            add(points, "ServiceSupplyPoint", endpoint)

if o.get("comment"):
    root.append(E.Comment("C14N fixture comment"))
signature = add(root, "Signature", ns=D)
info = add(signature, "SignedInfo", ns=D)
method = o.get("canonical", C)
add(info, "CanonicalizationMethod", ns=D, Algorithm=method)
add(info, "SignatureMethod", ns=D, Algorithm=o["signatureMethod"])
ref = add(info, "Reference", ns=D, URI="#" + o["id"])
transforms = add(ref, "Transforms", ns=D)
add(transforms, "Transform", ns=D, Algorithm=D + "enveloped-signature")
add(transforms, "Transform", ns=D, Algorithm=method)
add(ref, "DigestMethod", ns=D, Algorithm="http://www.w3.org/2001/04/xmlenc#sha256")
add(ref, "DigestValue", "AA==", ns=D)
add(signature, "SignatureValue", "U0lHTkFUVVJF", ns=D)
add(add(add(signature, "KeyInfo", ns=D), "X509Data", ns=D), "X509Certificate", o["signer"], ns=D)
root = E.fromstring(E.tostring(root, pretty_print=o.get("pretty", False)))
signature = root.find("{" + D + "}Signature")
info = signature.find("{" + D + "}SignedInfo")
unsigned = copy.deepcopy(root)
sig_copy = unsigned.find("{" + D + "}Signature")
if sig_copy.tail:
    sig_copy.getprevious().tail = (sig_copy.getprevious().tail or "") + sig_copy.tail
unsigned.remove(sig_copy)


def canonical(n):
    return E.tostring(n, method="c14n", exclusive=method.startswith(X), with_comments=method.endswith("WithComments"))


info.find(".//{" + D + "}DigestValue").text = base64.b64encode(hashlib.sha256(canonical(unsigned)).digest()).decode()
json.dump({"xml": E.tostring(root, xml_declaration=True, encoding="UTF-8").decode(),
           "signedInfo": base64.b64encode(canonical(info)).decode()}, sys.stdout)
