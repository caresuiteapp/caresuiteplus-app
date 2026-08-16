import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("assignment studio R4 contrast contract", () => {
  it("gives explicit dark surfaces priority over portal styles", () => {
    for (const file of [
      "src/components/ui/FilterChip.tsx",
      "src/components/ui/PremiumInput.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("!onDarkSurface");
      expect(source).toContain("onDarkSurface");
    }

    const panel = read("src/components/ui/SectionPanel.tsx");
    expect(panel).toMatch(/onDarkSurface\s*\?\s*"#FFFFFF"/);
    expect(panel).toMatch(/onDarkSurface\s*\?\s*"#0A2747"/);
  });

  it("keeps every assignment list row dark and readable", () => {
    const table = read("src/components/ui/PremiumDataTable.tsx");
    const assignmentTable = read(
      "src/components/assist/AssignmentsListTable.tsx",
    );
    expect(table).toContain("darkSurface && index % 2 === 1");
    expect(table).toContain("dataRowDarkAlt");
    expect(assignmentTable).toContain("darkSurface");
    expect(assignmentTable).toContain('color: "#F7FBFF"');
  });

  it("uses compact readable controls throughout assignment views", () => {
    const list = read("src/components/assist/AssignmentsListView.tsx");
    const create = read("src/components/assist/AssignmentCreateForm.tsx");
    const edit = read("src/components/assist/AssignmentEditForm.tsx");
    expect(list.match(/onDarkSurface/g)?.length).toBeGreaterThanOrEqual(6);
    expect(create).toContain("onDarkSurface: true as const");
    expect(edit).toContain("onDarkSurface: true as const");
  });

  it("prevents the desktop step navigation from expanding", () => {
    const scaffold = read("src/components/assist/AssignmentStudioScaffold.tsx");
    expect(scaffold).toContain("flexGrow: 0");
    expect(scaffold).toContain("flexShrink: 0");
    expect(scaffold).toContain('backgroundColor: "#071A31"');
  });

  it("keeps catalog controls bright on the dark form surface", () => {
    for (const file of [
      "src/components/office/assistCatalog/AssistCatalogGroupedChipSelect.tsx",
      "src/components/office/assistCatalog/AssistCatalogMultiSelect.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain('color: "#D5E8F7"');
      expect(source).toContain('backgroundColor: "#123452"');
      expect(source).toContain('color: "#FFFFFF"');
    }
  });

  it("keeps task packages and review summaries readable", () => {
    const create = read("src/components/assist/AssignmentCreateForm.tsx");
    expect(create).toContain(
      'packageTitle: { ...typography.body, color: "#FFFFFF"',
    );
    expect(create).toContain('color: "#BFD8EB"');
    expect(create.match(/<InfoBanner\s+onDarkSurface/g)?.length).toBe(6);
  });
});
