import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const screenPath = path.join(
  projectRoot,
  "src/liquid-command/screens/CommandCenterScreen.tsx",
);
const screenSource = fs.readFileSync(screenPath, "utf8");
const widgetRoot = path.join(
  projectRoot,
  "assets/healthos/widgets-premium",
);

function pngSize(filePath: string) {
  const data = fs.readFileSync(filePath);
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

describe("Command Center ruhige visuelle Dichte R10", () => {
  it.each([
    ["compact", 512, 512],
    ["medium", 1024, 512],
    ["large", 1536, 512],
  ] as const)(
    "liefert für %s genau 21 transparente Responsive-Artworks",
    (folder, width, height) => {
      const files = fs
        .readdirSync(path.join(widgetRoot, folder))
        .filter((file) => file.endsWith(".png"))
        .sort();

      expect(files).toHaveLength(21);
      for (const file of files) {
        expect(pngSize(path.join(widgetRoot, folder, file))).toEqual({
          width,
          height,
        });
      }
    },
  );

  it("kennzeichnet den beruhigten R10-Workspace nachvollziehbar", () => {
    expect(screenSource).toContain(
      'healthosVisualDensityRevision: "r10-calm"',
    );
    expect(screenSource).toContain('healthosResponsiveArtworkRevision: "r9"');
  });

  it("verhindert permanente Dock-Unruhe und reduziert nicht aktive Icons", () => {
    expect(screenSource).toContain("outputRange: [0, 0]");
    expect(screenSource).toContain("styles.widgetImageIdle");
    expect(screenSource).toContain("widgetImageIdle: { opacity: 0.76 }");
  });

  it("beruhigt Kartenaktionen und entfernt wiederholte Statuspunkte", () => {
    expect(screenSource).toContain("styles.favoriteRemoveIdle");
    expect(screenSource).toContain("favoriteRemoveIdle: { opacity: 0.16 }");
    expect(screenSource).not.toContain("styles.favoriteLabelDot");
  });

  it("bewahrt Freiraum um jedes Hauptmotiv", () => {
    expect(screenSource).toContain("top: 6");
    expect(screenSource).toContain("left: 12");
    expect(screenSource).toContain("right: 12");
    expect(screenSource).toContain("bottom: 38");
    expect(screenSource).toContain('resizeMode="contain"');
  });
});
