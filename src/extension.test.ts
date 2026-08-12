import assert from "node:assert/strict";
import test from "node:test";
import { quoteForBash } from "./shell.js";

test("quotes proxy paths for imported Bash functions", () => {
  assert.equal(quoteForBash("/tmp/codex title/bin/codex"), "'/tmp/codex title/bin/codex'");
  assert.equal(quoteForBash("/tmp/user's/bin/codex"), "'/tmp/user'\"'\"'s/bin/codex'");
});
