import { normalizeTags } from "../src/normalize-tags.js";

const input = [" Work ", "work", "HOME"];
const output = normalizeTags(input);

if (JSON.stringify(output) !== JSON.stringify(["work", "home"])) {
  throw new Error("unexpected normalized tags");
}
if (JSON.stringify(input) !== JSON.stringify([" Work ", "work", "HOME"])) {
  throw new Error("normalizeTags mutated its input");
}
