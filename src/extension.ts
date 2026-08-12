import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { resolveExecutable } from "./processCommand.js";
import { quoteForBash } from "./shell.js";

const ENV_PREFIX = "CODEX_TERMINAL_TITLE_";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Codex Terminal Title", { log: true });
  const collection = context.environmentVariableCollection;
  collection.description = "Automatically names Codex CLI terminals by routing codex through a local title proxy.";

  const configure = (): void => {
    collection.clear();
    const config = vscode.workspace.getConfiguration("codexTaskTerminal");
    if (!config.get<boolean>("autoDetect", true)) {
      output.info("Automatic Codex terminal detection is disabled.");
      return;
    }

    const proxyDirectory = context.asAbsolutePath("bin");
    const proxyExecutable = path.join(
      proxyDirectory,
      process.platform === "win32" ? "codex.exe" : "codex"
    );
    if (!fs.existsSync(proxyExecutable)) {
      output.error(`The platform proxy is missing: ${proxyExecutable}`);
      void vscode.window.showErrorMessage(
        "Codex Terminal Title could not find its platform proxy. Reinstall the correct platform package."
      );
      return;
    }

    const configuredCodex = config.get<string>("codexPath", "codex");
    const realCodex = resolveExecutable(configuredCodex, process.env);
    const originalPath = process.env.PATH ?? process.env.Path ?? "";

    collection.prepend("PATH", `${proxyDirectory}${path.delimiter}`);
    if (process.platform !== "win32") {
      collection.replace(
        "BASH_FUNC_codex%%",
        `() { ${quoteForBash(proxyExecutable)} "$@"; }`
      );
    }
    collection.replace(`${ENV_PREFIX}REAL_CODEX`, realCodex);
    collection.replace(`${ENV_PREFIX}ORIGINAL_PATH`, originalPath);
    collection.replace(
      `${ENV_PREFIX}EXTRA_ARGS`,
      JSON.stringify(config.get<string[]>("codexArgs", []))
    );
    collection.replace(
      `${ENV_PREFIX}TITLE_PREFIX`,
      config.get<string>("titlePrefix", "Codex: ")
    );
    collection.replace(
      `${ENV_PREFIX}PROMPT_MAX_WIDTH`,
      String(config.get<number>("promptMaxWidth", 32))
    );
    collection.replace(
      `${ENV_PREFIX}ELLIPSIS`,
      config.get<string>("ellipsis", "…")
    );
    collection.replace(
      `${ENV_PREFIX}POLL_INTERVAL_MS`,
      String(config.get<number>("pollIntervalMs", 1000))
    );
    output.info(`Automatic detection enabled. Real Codex CLI: ${realCodex}`);
  };

  configure();

  context.subscriptions.push(
    output,
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration("codexTaskTerminal")) {
        configure();
        void vscode.window.showInformationMessage(
          "Codex Terminal Title settings updated. Open a new terminal to apply them."
        );
      }
    }),
    vscode.commands.registerCommand("codexTaskTerminal.new", () => {
      const terminal = vscode.window.createTerminal({
        name: "Codex",
        cwd: terminalCwd()
      });
      terminal.show();
      terminal.sendText("codex");
    })
  );
}

export function deactivate(): void {}

function terminalCwd(): string | vscode.Uri | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file") {
    return vscode.workspace.getWorkspaceFolder(activeUri)?.uri ?? vscode.Uri.file(path.dirname(activeUri.fsPath));
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}
