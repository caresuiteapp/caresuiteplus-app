"""Verify CP345 workbook changes against the CP344 native workbook."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOCREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN}
TASK_ROWS = set(range(65, 77))
PACKET_ROWS = set(range(30, 34))
ALLOWED = {
    "Aufgaben": {f"{column}{row}" for row in TASK_ROWS for column in ("M",)},
    "Pakete": {f"{column}{row}" for row in PACKET_ROWS for column in ("G",)},
}


def xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    raw = archive.read(name)
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError(f"Unsafe XML declaration in {name}")
    return ET.fromstring(raw)


def relationships(archive: zipfile.ZipFile, name: str) -> dict[str, tuple[str, str, str]]:
    parent, leaf = posixpath.split(name)
    rels_name = posixpath.join(parent, "_rels", leaf + ".rels")
    if rels_name not in archive.namelist():
        return {}
    result = {}
    for rel in xml(archive, rels_name):
        identifier = rel.get("Id", "")
        edge = (rel.get("Type", ""), rel.get("Target", ""), rel.get("TargetMode", ""))
        if not identifier or identifier in result:
            raise ValueError(f"Invalid relationship in {rels_name}")
        result[identifier] = edge
    return result


def canonical_with_rels(element: ET.Element, rels: dict[str, tuple[str, str, str]]):
    attrs = []
    for key, value in element.attrib.items():
        attrs.append((key, rels[value]) if key.startswith("{" + DOCREL + "}") and value in rels else (key, value))
    return (element.tag, tuple(sorted(attrs)), element.text or "", tuple(canonical_with_rels(child, rels) for child in element))


def semantic_xml(archive: zipfile.ZipFile, name: str):
    root = xml(archive, name)
    if name.endswith(".rels"):
        edges = sorted((rel.get("Type", ""), rel.get("Target", ""), rel.get("TargetMode", "")) for rel in root)
        return root.tag, tuple(edges)
    return canonical_with_rels(root, relationships(archive, name))


def text_content(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.iter() if node.tag == f"{{{MAIN}}}t")


def workbook_model(path: Path):
    archive = zipfile.ZipFile(path)
    names = archive.namelist()
    if len(names) != len(set(names)) or archive.testzip() is not None:
        raise ValueError(f"Invalid ZIP container: {path}")
    shared = []
    if "xl/sharedStrings.xml" in names:
        shared = [text_content(node) for node in xml(archive, "xl/sharedStrings.xml")]
    relations = {rel.get("Id"): rel for rel in xml(archive, "xl/_rels/workbook.xml.rels")}
    sheets = {}
    paths = {}
    for sheet in xml(archive, "xl/workbook.xml").findall("m:sheets/m:sheet", NS):
        name = sheet.get("name")
        rel = relations.get(sheet.get(f"{{{DOCREL}}}id"))
        if not name or rel is None or rel.get("TargetMode") == "External":
            raise ValueError("Invalid worksheet relationship")
        target = rel.get("Target", "")
        target = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
        root = xml(archive, target)
        cells = {}
        rows = {}
        for row in root.findall("m:sheetData/m:row", NS):
            number = int(row.get("r", "0"))
            rows[number] = dict(row.attrib)
            for cell in row.findall("m:c", NS):
                address = cell.get("r", "")
                if not re.fullmatch(r"[A-Z]+[1-9][0-9]*", address) or address in cells:
                    raise ValueError(f"Invalid cell address in {name}: {address}")
                kind = cell.get("t", "n")
                value_node = cell.find("m:v", NS)
                value = "" if value_node is None else value_node.text or ""
                if kind == "s":
                    value = shared[int(value)]
                elif kind == "inlineStr":
                    inline = cell.find("m:is", NS)
                    value = "" if inline is None else text_content(inline)
                formula = cell.find("m:f", NS)
                cells[address] = {"value": value, "formula": None if formula is None else formula.text or "", "formulaAttrs": {} if formula is None else dict(formula.attrib), "style": cell.get("s"), "type": kind}
        sheet_data = root.find("m:sheetData", NS)
        sheet_rels = relationships(archive, target)
        structure = (root.tag, tuple(sorted(root.attrib.items())), root.text or "", tuple(canonical_with_rels(child, sheet_rels) for child in root if child is not sheet_data))
        sheets[name] = {"cells": cells, "rows": rows, "structure": structure}
        paths[name] = target
    return archive, set(names), sheets, paths


def normalize_target_row(attributes: dict[str, str]) -> dict[str, str]:
    return {
        key: value
        for key, value in attributes.items()
        if key not in {"ht", "customHeight"} and not (key == "hidden" and value == "0")
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("candidate", type=Path)
    args = parser.parse_args()
    source_zip, source_names, source, source_paths = workbook_model(args.source)
    candidate_zip, candidate_names, candidate, candidate_paths = workbook_model(args.candidate)
    try:
        if source_names != candidate_names or source_paths != candidate_paths or set(source) != set(candidate):
            raise ValueError("Workbook structure changed")
        excluded = {"xl/sharedStrings.xml", *source_paths.values()}
        for name in sorted(source_names - excluded):
            if name.endswith(".xml") or name.endswith(".rels"):
                if semantic_xml(source_zip, name) != semantic_xml(candidate_zip, name):
                    raise ValueError(f"Native XML part changed: {name}")
            elif source_zip.read(name) != candidate_zip.read(name):
                raise ValueError(f"Native binary part changed: {name}")
        changed = []
        formula_count = 0
        for sheet_name in source:
            before = source[sheet_name]
            after = candidate[sheet_name]
            if before["structure"] != after["structure"] or set(before["cells"]) != set(after["cells"]):
                raise ValueError(f"Worksheet structure changed: {sheet_name}")
            for address in sorted(before["cells"]):
                left = before["cells"][address]
                right = after["cells"][address]
                if right["formula"] is not None:
                    formula_count += 1
                if left != right:
                    if address not in ALLOWED.get(sheet_name, set()):
                        raise ValueError(f"Unexpected cell change: {sheet_name}!{address}")
                    if any(left[key] != right[key] for key in ("formula", "formulaAttrs", "style")):
                        raise ValueError(f"Formula/style changed in allowed cell: {sheet_name}!{address}")
                    changed.append(f"{sheet_name}!{address}")
            if set(before["rows"]) != set(after["rows"]):
                raise ValueError(f"Row set changed: {sheet_name}")
            allowed_rows = TASK_ROWS if sheet_name == "Aufgaben" else PACKET_ROWS if sheet_name == "Pakete" else set()
            for row_number in before["rows"]:
                left = before["rows"][row_number]
                right = after["rows"][row_number]
                if row_number in allowed_rows:
                    if normalize_target_row(left) != normalize_target_row(right):
                        raise ValueError(f"Unexpected row attribute change: {sheet_name}!{row_number}")
                    height = float(right.get("ht", "0"))
                    if not (0 < height <= 409.5) or right.get("customHeight") != "1":
                        raise ValueError(f"Invalid fitted height: {sheet_name}!{row_number}")
                elif left != right:
                    raise ValueError(f"Unexpected row metadata change: {sheet_name}!{row_number}")
        expected = sorted(address for sheet in ALLOWED.values() for address in sheet)
        if sorted(item.split("!", 1)[1] for item in changed) != expected:
            raise ValueError(f"Expected exactly {len(expected)} changed evidence cells, found {len(changed)}")
        if formula_count != 264:
            raise ValueError(f"Expected 264 formulas, found {formula_count}")
        print(json.dumps({"changedCells": len(changed), "changedRows": len(TASK_ROWS) + len(PACKET_ROWS), "formulaCount": formula_count, "nativeParts": len(candidate_names), "preservation": "matched"}, ensure_ascii=False))
    finally:
        source_zip.close()
        candidate_zip.close()


if __name__ == "__main__":
    main()
