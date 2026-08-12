# Codex Terminal Title

Stop guessing which `bash`, `PowerShell`, or `codex` terminal belongs to which task.

Codex Terminal Title gives every Codex CLI terminal a useful tab name automatically. While Codex is preparing its generated task title, the tab shows a shortened version of your first prompt. As soon as the generated title is available, the extension switches to it and keeps following later title changes.

## What it does

- **Shows your task immediately.** Your first prompt becomes the temporary terminal name, so a new task is recognizable without waiting.
- **Switches to the generated title automatically.** When Codex creates a concise task title, the terminal tab updates by itself.
- **Follows renamed tasks.** Rename the current Codex task and the terminal title follows.
- **Keeps long prompts readable.** Long prompts are shortened to fit the terminal tab without splitting Chinese characters or Emoji.
- **Prevents title overwrite.** Shells, Conda environments and other command-line tools cannot replace the task name with a generic process or folder name.
- **Keeps multiple Codex tasks separate.** Each extension-created terminal tracks its own Codex task.

## How the title changes

```text
Codex
  ↓ after you submit a prompt
Codex: 修复登录流程并补充相关测…
  ↓ after Codex generates a title
Codex: 修复 OAuth 登录流程
```

## Start a task

Open the Command Palette and run:

**Codex Terminal Title: New Codex Terminal**

You can also select **Codex Terminal Title** from the terminal profile menu.

The extension manages only the terminals it creates. Your existing terminals and shell configuration remain unchanged.

## Works where your Codex CLI works

- Windows
- macOS
- Linux
- WSL
- Remote SSH
- Dev Containers and Codespaces

When you use a remote workspace, install Codex CLI in that remote environment. The extension follows VS Code automatically and runs beside it.

## Requirements

- VS Code 1.96 or newer.
- Codex CLI installed in the same local or remote environment as the terminal.
- A Codex CLI version that supports App Server task metadata.

If the `codex` command is not on your PATH, set **Codex Terminal Title: Codex Path** to the executable name or absolute path.

## Settings

| Setting | Default | What it changes |
| --- | --- | --- |
| `codexTaskTerminal.codexPath` | `codex` | Location of the Codex CLI. |
| `codexTaskTerminal.codexArgs` | `[]` | Extra options passed when Codex starts. |
| `codexTaskTerminal.titlePrefix` | `Codex: ` | Text shown before each task name. |
| `codexTaskTerminal.promptMaxWidth` | `32` | Maximum width of the temporary prompt title. |
| `codexTaskTerminal.ellipsis` | `…` | Marker used when a prompt is shortened. |
| `codexTaskTerminal.pollIntervalMs` | `1000` | How quickly generated or renamed titles are detected. |

## Privacy

The extension reads prompt previews and task names from the Codex service running in the same local or remote workspace environment. It does not send this information to another service.

## Current limitation

If an unrelated Codex CLI is launched outside the extension in the exact same folder at the same moment, the extension may associate the new terminal with that task. Starting Codex tasks through this extension avoids the ambiguity in normal use.

## Feedback

Found a problem or have an idea? [Open an issue](https://github.com/Fubuki233/codex-terminal-title/issues).

Codex is a product of OpenAI. This community extension is not affiliated with or endorsed by OpenAI.
