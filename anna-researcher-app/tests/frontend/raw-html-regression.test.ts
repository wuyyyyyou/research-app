import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("report markdown safety regression", () => {
  it("does not use raw html insertion for report rendering source", () => {
    const root = process.cwd();
    const appSource = readFileSync(join(root, "src", "components", "ReportView.tsx"), "utf-8");
    expect(appSource).not.toContain("dangerouslySetInnerHTML");
    expect(appSource).not.toContain("innerHTML");
  });
});
