import fs from "node:fs";
import path from "node:path";

export function resolveExecutable(command: string, env: NodeJS.ProcessEnv): string {
  if (path.isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return command;
  }

  const directories = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, command + extension.toLowerCase());
      const originalCaseCandidate = path.join(directory, command + extension);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      if (fs.existsSync(originalCaseCandidate)) {
        return originalCaseCandidate;
      }
    }
  }
  return command;
}
