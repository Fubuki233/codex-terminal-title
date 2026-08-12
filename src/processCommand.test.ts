import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveExecutable } from "./processCommand.js";

test("preserves an explicitly configured absolute executable path", () => {
  const executable = path.resolve("custom", process.platform === "win32" ? "codex.exe" : "codex");
  assert.equal(resolveExecutable(executable, {}), executable);
});

test("leaves an unresolved command for the proxy to locate in the original PATH", () => {
  assert.equal(resolveExecutable("codex-not-installed", { PATH: "" }), "codex-not-installed");
});
