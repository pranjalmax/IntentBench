import path from "node:path";

const windowsReserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function validateRelativePath(relativePath: string): string {
  if (relativePath.length === 0) throw new Error("Relative path must not be empty");
  if (/^[a-z]:/iu.test(relativePath) || relativePath.startsWith("\\\\")) {
    throw new Error(`Absolute Windows path is forbidden: ${relativePath}`);
  }
  if (containsControlCharacter(relativePath)) {
    throw new Error("Control characters are forbidden in paths");
  }
  if (relativePath.includes(":"))
    throw new Error("Drive and alternate-data-stream syntax is forbidden");

  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.endsWith("/") || normalized.includes("//")) {
    throw new Error(`Path must be a nonempty relative file path: ${relativePath}`);
  }

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment === "." || segment === ".." || segment.length === 0) {
      throw new Error(`Traversal and empty path segments are forbidden: ${relativePath}`);
    }
    if (windowsReserved.test(segment) || /[. ]$/u.test(segment)) {
      throw new Error(`Windows-reserved path segment is forbidden: ${segment}`);
    }
  }
  return segments.join("/");
}

export function assertContained(root: string, candidate: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === "" || relative === ".") return;
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the owned root: ${candidate}`);
  }
}
