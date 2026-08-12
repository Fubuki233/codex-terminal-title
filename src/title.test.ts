import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTitle, titleForThread, truncateDisplayWidth } from "./title.js";

test("normalizes multiline prompts and control characters", () => {
  assert.equal(normalizeTitle("  fix\n\tthe\u0000 bug  "), "fix the bug");
});

test("prefers the generated Codex title", () => {
  assert.equal(titleForThread("Fix OAuth login", "long initial prompt", 12, "…"), "Fix OAuth login");
});

test("uses prompt preview before a generated title exists", () => {
  assert.equal(titleForThread(null, "fix the login bug", 12, "…"), "fix the log…");
});

test("truncates Chinese by terminal display width", () => {
  assert.equal(truncateDisplayWidth("修复用户登录问题", 9, "…"), "修复用户…");
});

test("keeps emoji graphemes intact", () => {
  assert.equal(truncateDisplayWidth("Fix 👨‍💻 login flow", 9, "…"), "Fix 👨‍💻 l…");
});

test("falls back to Codex before the first prompt", () => {
  assert.equal(titleForThread(undefined, undefined, 32, "…"), "Codex");
});
