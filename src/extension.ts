import path from "node:path";
import * as vscode from "vscode";
import { AppServerClient } from "./appServerClient.js";
import { CodexPseudoterminal } from "./codexTerminal.js";
import { ThreadMatcher } from "./threadMatcher.js";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Codex Terminal Title", { log: true });
  const config = vscode.workspace.getConfiguration("codexTaskTerminal");
  const executable = config.get<string>("codexPath", "codex");
  const appServer = new AppServerClient(executable, process.env, message => output.debug(message));
  const matcher = new ThreadMatcher(appServer);

  const createTerminal = (): vscode.Terminal => {
    const currentConfig = vscode.workspace.getConfiguration("codexTaskTerminal");
    const cwd = terminalCwd();
    const pty = new CodexPseudoterminal({
      cwd,
      executable: currentConfig.get<string>("codexPath", "codex"),
      args: currentConfig.get<string[]>("codexArgs", []),
      env: process.env,
      prefix: currentConfig.get<string>("titlePrefix", "Codex: "),
      promptMaxWidth: currentConfig.get<number>("promptMaxWidth", 32),
      ellipsis: currentConfig.get<string>("ellipsis", "…"),
      pollIntervalMs: currentConfig.get<number>("pollIntervalMs", 1000)
    }, appServer, matcher, message => output.debug(message));
    return vscode.window.createTerminal({
      name: "Codex",
      pty,
      iconPath: new vscode.ThemeIcon("terminal")
    });
  };

  context.subscriptions.push(
    output,
    { dispose: () => appServer.dispose() },
    vscode.commands.registerCommand("codexTaskTerminal.new", () => {
      const terminal = createTerminal();
      terminal.show();
    }),
    vscode.window.registerTerminalProfileProvider("codexTaskTerminal.profile", {
      provideTerminalProfile: () => new vscode.TerminalProfile({
        name: "Codex",
        pty: new CodexPseudoterminal({
          cwd: terminalCwd(),
          executable: vscode.workspace.getConfiguration("codexTaskTerminal").get("codexPath", "codex"),
          args: vscode.workspace.getConfiguration("codexTaskTerminal").get("codexArgs", []),
          env: process.env,
          prefix: vscode.workspace.getConfiguration("codexTaskTerminal").get("titlePrefix", "Codex: "),
          promptMaxWidth: vscode.workspace.getConfiguration("codexTaskTerminal").get("promptMaxWidth", 32),
          ellipsis: vscode.workspace.getConfiguration("codexTaskTerminal").get("ellipsis", "…"),
          pollIntervalMs: vscode.workspace.getConfiguration("codexTaskTerminal").get("pollIntervalMs", 1000)
        }, appServer, matcher, message => output.debug(message)),
        iconPath: new vscode.ThemeIcon("terminal")
      })
    })
  );
}

export function deactivate(): void {}

function terminalCwd(): string {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file") {
    const containingWorkspace = vscode.workspace.getWorkspaceFolder(activeUri);
    if (containingWorkspace) {
      return containingWorkspace.uri.fsPath;
    }
    return path.dirname(activeUri.fsPath);
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
}
