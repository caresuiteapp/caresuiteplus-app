import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../liquid-command/screens/CommandCenterScreen.tsx",
    import.meta.url,
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("HealthOS command center workspace harmony R5.1 bis R10", () => {
  it("gives the desktop page a clear premium heading hierarchy", () => {
    expect(source).toContain('healthosWorkspaceRevision: "r5-1"');
    expect(source).toContain("HEALTHOS WORKSPACE");
    expect(source).toContain("PERSÖNLICHER DESKTOP");
    expect(source).toContain("Ihre wichtigsten Bereiche – klar geordnet");
    expect(source).toMatch(/desktopPageTitle:\s*\{[\s\S]*?fontSize:\s*48/);
    expect(source).not.toContain("favoritesAmbientGlow");
    expect(source).toContain("styles.favoritesTopLine");
  });

  it("uses one shared grid scale for both widget rows", () => {
    expect(source).toContain("const favoriteRowUnitCounts = [0, 1].map");
    expect(source).toContain("const favoriteGridUnitCount = Math.max");
    expect(source).toContain("const favoriteGridUnitWidth = Math.max");
    expect(source).toContain("unitWidth={favoriteGridUnitWidth}");
    expect(source).not.toContain("const rowUnitWidth = Math.max");
    expect(source).toContain("itemHeight={favoriteItemHeight}");
    expect(source).not.toContain('justifyContent: "space-evenly"');
  });

  it("separates every image surface from a calm permanently readable label", () => {
    expect(source).toContain("styles.favoriteImageStage");
    expect(source).toContain("styles.favoriteLabelBar");
    expect(source).not.toContain("styles.favoriteLabelDot");
    expect(source).toContain("styles.favoriteLabelArrow");
    expect(source).toMatch(/favoriteLabelBar:\s*\{[\s\S]*?minHeight:\s*28/);
    expect(source).toMatch(/favoriteLabelText:\s*\{[\s\S]*?fontSize:\s*11/);
    expect(source).toContain("occupied && hovered && styles.favoriteSlotHovered");
    expect(source).toContain("Widget hinzufügen");
    expect(source).toMatch(/favoriteSlotHovered:\s*\{[\s\S]*?translateY:\s*-2/);
  });

  it("reduces the dock dominance so it supports the workspace", () => {
    expect(source).toContain(
      "const dockHeight = height < 720 ? 104 : compact ? 116 : 118;",
    );
    expect(source).toMatch(/dockRegion:\s*\{[\s\S]*?left:\s*78,[\s\S]*?height:\s*118/);
  });
});
