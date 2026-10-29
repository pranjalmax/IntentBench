import assert from "node:assert/strict";
import path from "node:path";

export function assertDependencyPolicy(manifest, lock) {
  const atLeast = (version, floor) => {
    assert.match(version, /^\d+\.\d+\.\d+$/u, "Expected a reviewed release, not a range");
    const parts = version.split(".").map(Number);
    const minimum = floor.split(".").map(Number);
    const differing = parts.findIndex((part, index) => part !== minimum[index]);
    return differing === -1 || parts[differing] > minimum[differing];
  };
  const pin = manifest.devDependencies.vitest;
  assert.ok(pin.startsWith("4.") && atLeast(pin, "4.1.12"), "Unpatched Vitest cohort");
  assert.equal(manifest.overrides.vitest, pin, "Keep optional peers on the reviewed major");
  assert.equal(lock.packages[""].devDependencies.vitest, pin);
  assert.equal(lock.packages["node_modules/vitest"].version, pin);
  assert.equal(lock.packages["node_modules/@vitest/mocker"].version, pin);
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (/(?:^|\/)node_modules\/undici$/u.test(location)) {
      assert.ok(entry.version.startsWith("7.") && atLeast(entry.version, "7.30.1"));
      assert.equal(entry.dev, true);
    }
    if (!/(?:^|\/)node_modules\/(?:vitest|@vitest\/[^/]+)$/u.test(location)) continue;
    assert.equal(entry.version, pin, "Mixed Vitest cohorts are not reviewed");
    assert.equal(entry.dev, true);
  }
  const undici = lock.packages["node_modules/undici"];
  assert.equal(undici.version, manifest.overrides.jsdom.undici);
  assert.ok(undici.version.startsWith("7.") && atLeast(undici.version, "7.30.1"));
  assert.equal(undici.dev, true);
  assert.equal(lock.packages["node_modules/jsdom"].dev, true);
}

export function isPublishablePath(file) {
  return (
    !file.includes("\\") &&
    !file.startsWith("/") &&
    !file.includes(":") &&
    !file
      .split("/")
      .some(
        (part) =>
          part === ".." ||
          part === "." ||
          part === "" ||
          [
            "private",
            "oracles",
            "variants",
            "mutants",
            "golden",
            ".git",
            "node_modules",
            ".intentbench-auth",
            ".intentbench-data",
          ].includes(part),
      ) &&
    !/^(?:intentbench|experiments|results|dist)\//u.test(file) &&
    !/(?:^|\/)(?:auth|credentials|truth)\.json$|(?:^|\/)oracle\.(?:ts|mjs|js)$|\.(?:pem|key|p12|pfx)$/iu.test(
      file,
    ) &&
    (!/(?:^|\/)\.env(?:\.|$)/u.test(file) || file.endsWith(".example"))
  );
}

// Same credential families checked by the historical sanitizer; never emit matches.
export function scanText(text) {
  const findings = [];
  if (
    [
      /AKIA[0-9A-Z]{16}/u,
      /gh[pousr]_[A-Za-z0-9_]{20,}/u,
      /(?<![\w-])sk-[A-Za-z0-9_-]{20,}/u,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{100,}-----END/u,
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/u,
    ].some((pattern) => pattern.test(text))
  )
    findings.push("credential-pattern");
  const normalized = text.replaceAll("\\\\", "\\");
  if (/[A-Z]:[\\/]Users[\\/][^\s\\/"']+|\/(?:Users|home)\/[^\s/"']+/iu.test(normalized))
    findings.push("personal-path");
  return findings;
}

export function localLinks(markdown) {
  const links = [...markdown.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/gu)].map(
    (match) => match[1],
  );
  links.push(...[...markdown.matchAll(/(?:src|href)="([^"]+)"/gu)].map((match) => match[1]));
  return links.filter((link) => !/^(?:https?:|mailto:)/iu.test(link));
}

export function resolveLocalLink(root, file, link) {
  const target = decodeURIComponent(link.split(/[?#]/u)[0]);
  assert.ok(!/^[a-z][a-z0-9+.-]*:|^[/\\]/iu.test(target), "Not a relative documentation link");
  const absolute = target
    ? path.resolve(root, path.dirname(file), target)
    : path.resolve(root, file);
  const relative = path.relative(root, absolute);
  assert.ok(
    relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    "Link escapes repository",
  );
  return absolute;
}
