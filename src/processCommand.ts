import fs from "node:fs";
import path from "node:path";

export interface ProcessCommand {
  file: string;
  args: string[];
}

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

export function commandForPlatform(
  executable: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): ProcessCommand {
  const resolved = resolveExecutable(executable, env);
  if (process.platform !== "win32" || !/\.(cmd|bat)$/i.test(resolved)) {
    return { file: resolved, args: [...args] };
  }

  const shell = env.ComSpec ?? env.COMSPEC ?? "cmd.exe";
  const commandLine = [resolved, ...args].map(quoteCmdArgument).join(" ");
  return { file: shell, args: ["/d", "/s", "/c", commandLine] };
}

function quoteCmdArgument(value: string): string {
  if (!/[\s&()\[\]{}^=;!'+,`~]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
