import { describe, expect, it } from "vitest";

import { advanceCounter } from "../src/counter.js";

describe("advanceCounter", () => {
  it("advances without mutating the source", () => {
    const current = { value: 2 };
    expect(advanceCounter(current, 3)).toEqual({ value: 5 });
    expect(current).toEqual({ value: 2 });
  });
});
