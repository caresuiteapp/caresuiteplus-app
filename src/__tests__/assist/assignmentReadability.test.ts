import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("assignment studio readability", () => {
  it("pins the editor workspace to dark-surface contrast", () => {
    const source = read("../../components/assist/AssignmentStudioScaffold.tsx");
    expect(source).toContain("SurfaceContrastProvider");
    expect(source).toContain('tone="dark"');
  });

  it("pins assignment search, filters and tables to dark-surface contrast", () => {
    const list = read("../../components/assist/AssignmentsListView.tsx");
    const table = read("../../components/assist/AssignmentsListTable.tsx");
    expect(list).toContain('tone="dark"');
    expect(list).toContain('color: "#CBE2F4"');
    expect(list).toContain('color: "#AFC7DA"');
    expect(table).toContain('color: "#F7FBFF"');
    expect(table).toContain('color: "#B8CEE0"');
  });

  it("suppresses low-contrast format helper text in the dark editor", () => {
    const edit = read("../../components/assist/AssignmentEditForm.tsx");
    const create = read("../../components/assist/AssignmentCreateForm.tsx");
    expect(edit).toContain("showFormatHint={false}");
    expect((create.match(/showFormatHint=\{false\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
