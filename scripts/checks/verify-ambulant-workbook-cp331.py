#!/usr/bin/env python3
"""Semantically compare the CP331 workbook with its confirmed predecessor."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET


MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"x": MAIN, "r": OFFICE_REL, "p": PKG_REL}


def q(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


def read_xml(book: ZipFile, name: str) -> ET.Element:
    return ET.fromstring(book.read(name))


def relationships(book: ZipFile, name: str) -> tuple[tuple[str, str, str], ...]:
    root = read_xml(book, name)
    values = []
    for node in root.findall("p:Relationship", NS):
        values.append(
            (
                node.attrib.get("Type", ""),
                node.attrib.get("Target", ""),
                node.attrib.get("TargetMode", ""),
            )
        )
    return tuple(sorted(values))


def relationship_map(book: ZipFile, name: str) -> dict[str, str]:
    root = read_xml(book, name)
    return {
        node.attrib["Id"]: f"{node.attrib.get('Type', '')}|{node.attrib.get('Target', '')}|{node.attrib.get('TargetMode', '')}"
        for node in root.findall("p:Relationship", NS)
    }


def shared_strings(book: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in book.namelist():
        return []
    root = read_xml(book, "xl/sharedStrings.xml")
    return ["".join(t.text or "" for t in si.iter(q(MAIN, "t"))) for si in root.findall("x:si", NS)]


def workbook_sheets(book: ZipFile) -> dict[str, str]:
    workbook = read_xml(book, "xl/workbook.xml")
    rels = read_xml(book, "xl/_rels/workbook.xml.rels")
    by_id = {node.attrib["Id"]: node.attrib["Target"] for node in rels.findall("p:Relationship", NS)}
    result: dict[str, str] = {}
    for sheet in workbook.findall("x:sheets/x:sheet", NS):
        target = by_id[sheet.attrib[q(OFFICE_REL, "id")]].lstrip("/")
        result[sheet.attrib["name"]] = target if target.startswith("xl/") else "xl/" + target
    return result


def cell_value(cell: ET.Element, strings: list[str]) -> str | None:
    kind = cell.attrib.get("t")
    value_node = cell.find("x:v", NS)
    raw = value_node.text if value_node is not None else None
    if kind == "s" and raw is not None:
        return strings[int(raw)]
    if kind == "inlineStr":
        inline = cell.find("x:is", NS)
        return "" if inline is None else "".join(t.text or "" for t in inline.iter(q(MAIN, "t")))
    return raw


def cells(book: ZipFile, sheet_path: str) -> dict[str, dict[str, str | None]]:
    strings = shared_strings(book)
    root = read_xml(book, sheet_path)
    result = {}
    for cell in root.findall(".//x:sheetData/x:row/x:c", NS):
        formula = cell.find("x:f", NS)
        result[cell.attrib["r"]] = {
            "style": cell.attrib.get("s"),
            "type": cell.attrib.get("t"),
            "formula": None if formula is None else formula.text or "",
            "value": cell_value(cell, strings),
        }
    return result


def row_properties(book: ZipFile, sheet_path: str) -> dict[str, dict[str, str]]:
    root = read_xml(book, sheet_path)
    result = {}
    for row in root.findall(".//x:sheetData/x:row", NS):
        properties = {key: value for key, value in row.attrib.items() if key != "r"}
        if properties.get("hidden") == "0":
            properties.pop("hidden")
        result[row.attrib["r"]] = properties
    return result


def local(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def canonical(node: ET.Element, rels: dict[str, str]) -> tuple:
    attrs = []
    for key, value in node.attrib.items():
        if key == q(OFFICE_REL, "id"):
            value = rels.get(value, value)
        attrs.append((key, value))
    children = [
        canonical(child, rels)
        for child in node
        if local(child.tag) not in {"sheetData", "dimension"}
    ]
    return (node.tag, tuple(sorted(attrs)), (node.text or "").strip(), tuple(children))


def worksheet_shell(book: ZipFile, sheet_path: str) -> tuple:
    root = read_xml(book, sheet_path)
    filename = Path(sheet_path).name
    rel_path = f"xl/worksheets/_rels/{filename}.rels"
    rels = relationship_map(book, rel_path) if rel_path in book.namelist() else {}
    return canonical(root, rels)


def workbook_signature(book: ZipFile) -> tuple:
    sheets = workbook_sheets(book)
    workbook_rels = relationship_map(book, "xl/_rels/workbook.xml.rels")
    root = read_xml(book, "xl/workbook.xml")
    return (
        tuple(sorted(sheets.items())),
        canonical(root, workbook_rels),
        relationships(book, "_rels/.rels"),
        relationships(book, "xl/_rels/workbook.xml.rels"),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("plan", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()

    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    allowed = {(item["sheet"], item["address"]): (item["before"], item["value"]) for item in plan["edits"]}
    allowed_rows: dict[str, set[str]] = {}
    for sheet, address in allowed:
        match = re.search(r"(\d+)$", address)
        if not match:
            raise ValueError(f"Invalid cell address: {address}")
        allowed_rows.setdefault(sheet, set()).add(match.group(1))

    failures: list[str] = []
    changed_cells: list[dict[str, str | None]] = []
    changed_rows: list[dict[str, object]] = []
    with ZipFile(args.source) as source, ZipFile(args.output) as output:
        if set(source.namelist()) != set(output.namelist()):
            failures.append("package member set changed")
        source_sheets = workbook_sheets(source)
        output_sheets = workbook_sheets(output)
        if source_sheets != output_sheets:
            failures.append("sheet name/target mapping changed")
        if workbook_signature(source) != workbook_signature(output):
            failures.append("workbook or package relationship semantics changed")

        changed_members = []
        for name in sorted(set(source.namelist()) & set(output.namelist())):
            if hashlib.sha256(source.read(name)).digest() != hashlib.sha256(output.read(name)).digest():
                changed_members.append(name)
        permitted_members = {
            "_rels/.rels",
            "xl/_rels/workbook.xml.rels",
            "xl/workbook.xml",
            *(f"xl/worksheets/sheet{i}.xml" for i in range(1, 5)),
            *(f"xl/worksheets/_rels/sheet{i}.xml.rels" for i in range(1, 5)),
        }
        unexpected_members = sorted(set(changed_members) - permitted_members)
        if unexpected_members:
            failures.append(f"unexpected binary package changes: {unexpected_members}")

        formula_count_source = 0
        formula_count_output = 0
        for sheet_name, source_path in source_sheets.items():
            output_path = output_sheets[sheet_name]
            source_cells = cells(source, source_path)
            output_cells = cells(output, output_path)
            if set(source_cells) != set(output_cells):
                failures.append(f"{sheet_name}: cell address set changed")
            for address in sorted(set(source_cells) | set(output_cells)):
                before = source_cells.get(address)
                after = output_cells.get(address)
                if before and before["formula"] is not None:
                    formula_count_source += 1
                if after and after["formula"] is not None:
                    formula_count_output += 1
                if before == after:
                    continue
                changed_cells.append(
                    {
                        "sheet": sheet_name,
                        "address": address,
                        "before": None if before is None else before["value"],
                        "after": None if after is None else after["value"],
                    }
                )
                expected = allowed.get((sheet_name, address))
                if expected is None:
                    failures.append(f"unexpected cell change {sheet_name}!{address}")
                    continue
                if before is None or after is None:
                    failures.append(f"planned cell missing {sheet_name}!{address}")
                    continue
                if before["value"] != expected[0] or after["value"] != expected[1]:
                    failures.append(f"planned value mismatch {sheet_name}!{address}")
                if before["style"] != after["style"] or before["type"] != after["type"]:
                    failures.append(f"style/type changed {sheet_name}!{address}")
                if before["formula"] != after["formula"]:
                    failures.append(f"formula changed {sheet_name}!{address}")

            source_rows = row_properties(source, source_path)
            output_rows = row_properties(output, output_path)
            if set(source_rows) != set(output_rows):
                failures.append(f"{sheet_name}: row set changed")
            for row in sorted(set(source_rows) | set(output_rows), key=int):
                before = source_rows.get(row, {})
                after = output_rows.get(row, {})
                if before == after:
                    continue
                changed_rows.append({"sheet": sheet_name, "row": row, "before": before, "after": after})
                if row not in allowed_rows.get(sheet_name, set()):
                    failures.append(f"unexpected row property change {sheet_name}!{row}")
                before_stable = {k: v for k, v in before.items() if k not in {"ht", "customHeight"}}
                after_stable = {k: v for k, v in after.items() if k not in {"ht", "customHeight"}}
                if before_stable != after_stable:
                    failures.append(f"non-height row property changed {sheet_name}!{row}")

            if worksheet_shell(source, source_path) != worksheet_shell(output, output_path):
                failures.append(f"{sheet_name}: worksheet structures outside cells/rows changed")

            source_rel = f"xl/worksheets/_rels/{Path(source_path).name}.rels"
            output_rel = f"xl/worksheets/_rels/{Path(output_path).name}.rels"
            if source_rel in source.namelist() and output_rel in output.namelist():
                if relationships(source, source_rel) != relationships(output, output_rel):
                    failures.append(f"{sheet_name}: worksheet relationships changed")

        actual_changes = {(item["sheet"], item["address"]) for item in changed_cells}
        missing_changes = sorted(set(allowed) - actual_changes)
        if missing_changes:
            failures.append(f"planned changes missing: {missing_changes}")
        if formula_count_source != formula_count_output or formula_count_output != 264:
            failures.append(
                f"formula count mismatch source={formula_count_source} output={formula_count_output} expected=264"
            )

    report = {
        "checkpoint": 331,
        "source": str(args.source),
        "output": str(args.output),
        "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
        "planned_cell_changes": len(allowed),
        "actual_cell_changes": len(changed_cells),
        "changed_cells": changed_cells,
        "changed_row_count": len(changed_rows),
        "changed_rows": changed_rows,
        "formula_count_source": formula_count_source,
        "formula_count_output": formula_count_output,
        "failures": failures,
        "ok": not failures,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("ok", "planned_cell_changes", "actual_cell_changes", "changed_row_count", "formula_count_output", "failures")}, ensure_ascii=False))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
