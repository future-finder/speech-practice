import { test, expect } from "@playwright/test";
import { playbackRange } from "../../src/segment";

test("evidence replay context clamps to recording boundaries", () => {
  expect(playbackRange(0.1, 0.4, 1)).toEqual({ start: 0, end: 0.65 });
  expect(playbackRange(0.8, 1, 1)).toEqual({ start: 0.55, end: 1 });
  expect(playbackRange(null, 0.4, 1)).toBeNull();
  expect(playbackRange(0.9, 0.8, 1)).toBeNull();
  expect(playbackRange(0, 2, 1)).toBeNull();
  expect(playbackRange(NaN, 1, 1)).toBeNull();
});
