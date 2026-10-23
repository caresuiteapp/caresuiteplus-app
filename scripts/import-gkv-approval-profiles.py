#!/usr/bin/env python3
"""Extract only requirement references from reviewed gematik profile snapshots.

No downloading, installation or compliance decision. Original HTML stays outside
the repository; its exact bytes must match source-lock.json. Requirement titles
and normative prose are deliberately not copied into the register.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'docs/gkv/approval'
ID = re.compile(r'(?:[A-Z0-9]+-)*A_\d+(?:-\d+)?')
LEVELS = {'MUSS', 'SOLL', 'KANN', 'DARF NICHT'}


def extract(source, data):
    if hashlib.sha256(data).hexdigest() != source['sha256']:
        raise ValueError(f"{source['id']}: source bytes changed; review the source lock first")
    tree = html.fromstring(data)
    if not tree.xpath('//h1[contains(., $name)]', name=source['documentId']):
        raise ValueError(f"{source['id']}: unexpected document")
    rows, variants, document_versions = [], [], {}
    for table in tree.xpath('//table'):
        trs = table.xpath('.//tr')
        cells = trs[0].xpath('./th|./td') if trs else []
        if not cells:
            continue
        header = cells[0].text_content().strip()
        if header == 'Dokumentenkürzel':
            for tr in trs[1:]:
                cs = tr.xpath('./th|./td')
                if len(cs) != 3:
                    raise ValueError('Unexpected document version table')
                document_versions[cs[0].text_content().strip()] = cs[2].text_content().strip()
            continue
        if header not in {'ID', 'Afo-ID'}:
            continue
        headings = table.xpath('preceding::h2[1] | preceding::h3[1] | preceding::h4[1] | preceding::h5[1]')
        section = headings[-1].text_content().strip().split()[0]
        for tr in trs[1:]:
            cs = tr.xpath('./th|./td')
            requirement = cs[0].text_content().strip()
            if not requirement:
                if len(cs) != 3 or 'Es liegen keine Festlegungen vor' not in cs[1].text_content():
                    raise ValueError('Unknown empty requirement row')
                continue
            if not ID.fullmatch(requirement) or len(cs) != 3:
                raise ValueError(f'Unrecognized requirement row: {requirement}')
            if header == 'Afo-ID':
                variants.append({'id': requirement, 'section': section})
                continue
            anchors = cs[0].xpath('.//a[@href]')
            if len(anchors) != 1 or anchors[0].get('severity') not in LEVELS:
                raise ValueError(f'{requirement}: missing source or obligation level')
            url = urljoin(source['url'], anchors[0].get('href'))
            parsed = urlparse(url)
            spec = cs[2].text_content().strip()
            version = document_versions.get(spec)
            if (parsed.scheme != 'https' or parsed.netloc != 'gemspec.gematik.de'
                    or parsed.fragment != requirement or not version
                    or f'/{spec}_V{version}/' not in parsed.path):
                raise ValueError(f'{requirement}: unpinned or inconsistent normative reference')
            rows.append({'id': requirement, 'section': section,
                         'level': anchors[0].get('severity'), 'spec': spec,
                         'version': version, 'url': url})
    # Some IDs occur in both VZD specifications and in several proof methods.
    # Neither occurrence may silently replace the other.
    keys = [(r['section'], r['id'], r['spec']) for r in rows]
    if len(set(keys)) != len(keys) or len(rows) != source['expectedOccurrences']:
        raise ValueError(f"{source['id']}: duplicate or missing requirements ({len(rows)})")
    if len({r['id'] for r in rows}) != source['expectedUniqueIds']:
        raise ValueError(f"{source['id']}: unique requirement count changed")
    # Preserve unresolved references instead of silently changing revision IDs.
    for variant in variants:
        variant['listedInPrimaryTables'] = variant['id'] in {r['id'] for r in rows}
    return {'sourceId': source['id'], 'documentVersions': document_versions,
            'variantReferences': variants, 'requirements': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    lock = json.loads((DIRECTORY / 'source-lock.json').read_text())
    profiles = [s for s in lock['sources'] if s['kind'] == 'gematik_profile']
    result = {'schemaVersion': 1, 'profiles': [extract(s, (args.source_dir / s['snapshot']).read_bytes()) for s in profiles]}
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    target = DIRECTORY / 'kim-register.json'
    if args.write:
        target.write_text(rendered)
    elif target.read_text() != rendered:
        raise ValueError('kim-register.json differs from the pinned source snapshots')
    print(f"{sum(len(p['requirements']) for p in result['profiles'])} requirement references verified across {len(profiles)} profiles")


if __name__ == '__main__':
    main()
