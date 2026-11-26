import { describe, expect, test } from "bun:test";

import { uuidv7 } from "@/lib/uuid";

const V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  test("has version 7 and RFC 9562 variant", () => {
    for (let i = 0; i < 1000; i++) expect(uuidv7()).toMatch(V7);
  });

  test("encodes the current unix milliseconds", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    const ms = parseInt(id.replace(/-/g, "").slice(0, 12), 16);
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  test("is unique", () => {
    const ids = new Set(Array.from({ length: 5000 }, uuidv7));
    expect(ids.size).toBe(5000);
  });
});
