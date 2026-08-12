import assert from "node:assert/strict";
import test from "node:test";
import { OscTitleFilter } from "./oscTitleFilter.js";

test("removes OSC terminal title sequences", () => {
  const filter = new OscTitleFilter();
  assert.equal(filter.push("before\u001b]0;shell title\u0007after"), "beforeafter");
});

test("handles OSC sequences split across chunks", () => {
  const filter = new OscTitleFilter();
  assert.equal(filter.push("a\u001b]2;partial"), "a");
  assert.equal(filter.push(" title\u001b\\b"), "b");
});

test("preserves unrelated OSC sequences", () => {
  const filter = new OscTitleFilter();
  assert.equal(filter.push("\u001b]9;4;1;50\u0007"), "\u001b]9;4;1;50\u0007");
});
