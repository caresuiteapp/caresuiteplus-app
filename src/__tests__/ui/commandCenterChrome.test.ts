import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../liquid-command/screens/CommandCenterScreen.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("HealthOS command center chrome", () => {
  it("uses readable role labels and exposes a secure logout action", () => {
    expect(source).toContain('business_admin: "Geschäftsführung / Admin"');
    expect(source).toContain("Sicher abmelden");
    expect(source).toContain("await auth.signOut()");
  });

  it("removes ambient loops and keeps widget artwork uncropped", () => {
    expect(source).not.toContain("healthos-ping-pong-aurora");
    expect(source).not.toContain("styles.aurora");
    expect(source).toContain('resizeMode="cover"');
    expect(source).toContain('resizeMode="contain"');
    expect(source).toMatch(/widgetImage:\s*\{\s*width:\s*"100%",\s*height:\s*"100%"/);
  });

  it("aligns the wider brand mark with the information card", () => {
    expect(source).toContain("logo: { width: 430, height: 54 }");
    expect(source).toMatch(/infoCard:\s*\{\s*minWidth:\s*430/);
  });
});
