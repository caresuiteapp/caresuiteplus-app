import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../liquid-command/screens/CommandCenterScreen.tsx",
    import.meta.url,
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("HealthOS command center workspace harmony R5", () => {
  it("gives the desktop page a clear premium heading hierarchy", () => {
    expect(source).toContain("HEALTHOS WORKSPACE");
    expect(source).toContain("PERSÖNLICHER DESKTOP");
    expect(source).toContain("Ihre wichtigsten Bereiche – klar geordnet");
    expect(source).toMatch(/desktopPageTitle:\s*\{[\s\S]*?fontSize:\s*35/);
    expect(source).toContain("styles.favoritesAmbientGlow");
    expect(source).toContain("styles.favoritesTopLine");
  });

  it("fills both widget rows proportionally instead of scattering fixed tiles", () => {
    expect(source).toContain("const rowUnits = rowSlots.reduce");
    expect(source).toContain("const rowUnitWidth = Math.max");
    expect(source).toContain("unitWidth={rowUnitWidth}");
    expect(source).toContain("itemHeight={favoriteItemHeight}");
    expect(source).not.toContain('justifyContent: "space-evenly"');
  });

  it("keeps widget identity visible and adds deliberate interaction effects", () => {
    expect(source).toContain("styles.favoriteLabelBar");
    expect(source).toContain("styles.favoriteLabelDot");
    expect(source).toContain("styles.favoriteLabelArrow");
    expect(source).toContain("occupied && hovered && styles.favoriteSlotHovered");
    expect(source).toContain("Widget hinzufügen");
    expect(source).toMatch(/favoriteSlotHovered:\s*\{[\s\S]*?translateY:\s*-5/);
  });

  it("reduces the dock dominance so it supports the workspace", () => {
    expect(source).toContain(
      "const dockHeight = height < 720 ? 104 : compact ? 116 : 118;",
    );
    expect(source).toMatch(/dockRegion:\s*\{[\s\S]*?left:\s*78,[\s\S]*?height:\s*118/);
  });
});
