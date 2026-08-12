import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const platformNames = { win32: "windows", linux: "linux", darwin: "darwin" };
const architectureNames = { x64: "amd64", arm64: "arm64" };
const requestedTarget = process.env.VSCODE_TARGET;
const [targetPlatform, targetArchitecture] = requestedTarget
  ? requestedTarget.split("-")
  : [process.platform, process.arch];
const goos = platformNames[targetPlatform];
const goarch = architectureNames[targetArchitecture];

if (!goos || !goarch) {
  throw new Error(`Unsupported proxy target: ${targetPlatform}-${targetArchitecture}`);
}

mkdirSync(resolve("bin"), { recursive: true });
rmSync(resolve("bin", "codex"), { force: true });
rmSync(resolve("bin", "codex.exe"), { force: true });
const output = resolve(
  "bin",
  goos === "windows" ? "codex.exe" : "codex"
);
const go = process.env.GO_BINARY || "go";
const result = spawnSync(
  go,
  ["build", "-trimpath", "-ldflags", "-s -w", "-o", output, "./proxy"],
  {
    stdio: "inherit",
    env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" }
  }
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
