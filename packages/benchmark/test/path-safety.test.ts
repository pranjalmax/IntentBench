import path from "node:path";

import { describe, expect, it } from "vitest";

import { assertContained, validateRelativePath } from "../src/path-safety.js";

describe("validateRelativePath", () => {
  it.each([
    ["parent traversal", "../private/oracle.ts"],
    ["nested traversal", "src/../../private/oracle.ts"],
    ["absolute POSIX path", "/private/oracle.ts"],
    ["drive path", "C:\\private\\oracle.ts"],
    ["UNC path", "\\\\server\\share\\oracle.ts"],
    ["alternate data stream", "src/file.ts:private"],
    ["control character", "src/secret\u0000.ts"],
    ["empty segment", "src//file.ts"],
    ["reserved Windows name", "src/CON.ts"],
  ])("rejects %s", (_name, candidate) => {
    expect(() => validateRelativePath(candidate)).toThrow();
  });

  it("normalizes backslashes into portable separators", () => {
    expect(validateRelativePath("src\\nested\\file.ts")).toBe("src/nested/file.ts");
  });
});

describe("assertContained", () => {
  it("accepts descendants and rejects siblings with a shared string prefix", () => {
    const root = path.resolve("sandbox", "task");
    expect(() => assertContained(root, path.join(root, "src", "index.ts"))).not.toThrow();
    expect(() =>
      assertContained(root, path.resolve("sandbox", "task-private", "oracle.ts")),
    ).toThrow();
  });
});
