import assert from "node:assert/strict";
import path from "node:path";

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
